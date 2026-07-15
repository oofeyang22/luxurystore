import crypto from "crypto";
import axios from "axios";
import Stripe from "stripe";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";

const currency = "usd";
const delivery_charge = 49;


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;


const placeOrder = async (req, res, next) => {
  try {
    const { userId, address, amount, items } = req.body;

    const orderData = { items, address, amount, userId, paymentMethod: "COD", payment: false, date: Date.now() };

    const newOrder = new orderModel(orderData);
    await newOrder.save();

    await userModel.findByIdAndUpdate(userId, { cartData: {} });

    res.json({ success: true, message: "Order Placed" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


const placeOrderStripe = async (req, res, next) => {
  try {
    const { userId, address, amount, items } = req.body;
    const { origin } = req.headers;

    const orderData = {
      items,
      address,
      amount,
      userId,
      paymentMethod: "stripe",
      payment: false,
      date: Date.now(),
    };


    const dbProducts = await productModel.find({
      _id: { $in: items.map((item) => item._id) },
    });
    const priceById = new Map(dbProducts.map((p) => [p._id.toString(), p.price]));

    for (const item of items) {
      if (!priceById.has(item._id?.toString())) {
        return res.json({ success: false, message: `Product ${item._id} not found` });
      }
    }

    const newOrder = new orderModel(orderData);
    await newOrder.save();

    const line_items = items.map((item) => ({
      price_data: {
        currency: currency,
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(priceById.get(item._id.toString()) * 100),
      },
      quantity: item.quantity,
    }));

    line_items.push({
      price_data: {
        currency: currency,
        product_data: {
          name: "Delivery Charges",
        },
        unit_amount: Math.round(delivery_charge * 100),
      },
      quantity: 1,
    });

    const session = await stripe.checkout.sessions.create({
      success_url: `${origin}/verify?success=true&orderId=${newOrder._id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/verify?success=false&orderId=${newOrder._id}`,
      line_items,
      mode: "payment",
      metadata: {
        orderId: newOrder._id.toString(),
        userId: userId,
      },
    });

    res.json({ success: true, session_url: session.url, sessionId: session.id });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


const USD_NGN_RATE = parseFloat(process.env.USD_NGN_RATE);

const placeOrderPaystack = async (req, res, next) => {
  try {
    const { userId, address, items } = req.body;
    const { origin } = req.headers;

    if (!address?.email) {
      return res.json({ success: false, message: "Email is required for Paystack payment" });
    }

    if (!USD_NGN_RATE || Number.isNaN(USD_NGN_RATE)) {
      console.log("USD_NGN_RATE is not configured");
      return res.json({ success: false, message: "Payment temporarily unavailable" });
    }

    const dbProducts = await productModel.find({
      _id: { $in: items.map((item) => item._id) },
    });
    const priceById = new Map(dbProducts.map((p) => [p._id.toString(), p.price]));

    let usdTotal = delivery_charge;
    for (const item of items) {
      const price = priceById.get(item._id?.toString());
      if (price === undefined) {
        return res.json({ success: false, message: `Product ${item._id} not found` });
      }
      usdTotal += price * item.quantity;
    }

    const ngnTotal = usdTotal * USD_NGN_RATE;
    const amountKobo = Math.round(ngnTotal * 100);

    const orderData = {
      items,
      address,
      amount: usdTotal,
      userId,
      paymentMethod: "paystack",
      payment: false,
      paystackAmountKobo: amountKobo,
      date: Date.now(),
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save();


    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: address.email,
        amount: amountKobo,
        currency: "NGN",
        callback_url: `${origin}/verify?orderId=${newOrder._id}`,
        metadata: {
          orderId: newOrder._id.toString(),
          userId: userId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status) {
      res.json({
        success: true,
        authorization_url: response.data.data.authorization_url,
        reference: response.data.data.reference,
      });
    } else {
      await orderModel.findByIdAndDelete(newOrder._id);
      res.json({ success: false, message: "Unable to initialize Paystack payment" });
    }
  } catch (error) {
    console.log(error?.response?.data || error);
    res.json({ success: false, message: error.message });
  }
};


const placeOrderRazorpay = async (req, res, next) => {
  try {
  } catch (error) {
    next(error);
  }
};


const allOrders = async (req, res, next) => {
  try {
    const orders = await orderModel.find({});
    res.json({ success: true, orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


const userOrders = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const orders = await orderModel.find({ userId });
    res.json({ success: true, orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


const updateStatus = async (req, res, next) => {
  try {
    const { orderId, status } = req.body;

    await orderModel.findByIdAndUpdate(orderId, { status });
    res.json({ success: true, message: "Status updated" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


const verifyStripePayment = async (req, res, next) => {
  try {
    const { orderId, success, userId, sessionId } = req.body;

    if (success === "true") {
      const order = await orderModel.findById(orderId);

      if (!order) {
        return res.json({ success: false, message: "Order not found" });
      }

      if (order.payment === true) {
        await userModel.findByIdAndUpdate(userId, { cartData: {} });
        return res.json({ success: true, message: "Payment confirmed" });
      }

      if (sessionId) {
        try {
          const session = await stripe.checkout.sessions.retrieve(sessionId);

          if (session.metadata?.orderId !== orderId) {
            console.log(`Stripe orderId mismatch: session ${sessionId} belongs to order ${session.metadata?.orderId}, not ${orderId}`);
            return res.json({ success: false, message: "Payment verification failed" });
          }

          if (session.payment_status === "paid") {
            await orderModel.findByIdAndUpdate(orderId, {
              payment: true,
              paymentIntentId: session.payment_intent,
              status: "Confirmed",
            });
            await userModel.findByIdAndUpdate(userId, { cartData: {} });
            return res.json({ success: true, message: "Payment confirmed" });
          }
        } catch (stripeErr) {
          console.log(`Stripe session lookup failed: ${stripeErr.message}`);
        }
      }


      await new Promise((resolve) => setTimeout(resolve, 3000));
      const updatedOrder = await orderModel.findById(orderId);

      if (updatedOrder && updatedOrder.payment === true) {
        await userModel.findByIdAndUpdate(userId, { cartData: {} });
        res.json({ success: true, message: "Payment confirmed" });
      } else {
        res.json({ success: false, message: "Payment pending" });
      }
    } else {
      const order = await orderModel.findById(orderId);
      if (order && !order.payment) {
        await orderModel.findByIdAndDelete(orderId);
      }
      res.json({ success: false, message: "Payment cancelled" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


const verifyPaystack = async (req, res, next) => {
  try {
    const { orderId, reference, userId } = req.body;

    if (!reference) {
      return res.json({ success: false, message: "Missing transaction reference" });
    }

    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });

    const { status, data } = response.data;

    if (status && data.status === "success") {
      const order = await orderModel.findById(orderId);

      if (!order) {
        return res.json({ success: false, message: "Order not found" });
      }


      if (data.metadata?.orderId !== orderId) {
        console.log(`Paystack orderId mismatch: reference ${reference} belongs to order ${data.metadata?.orderId}, not ${orderId}`);
        return res.json({ success: false, message: "Payment verification failed" });
      }

      if (order.paystackAmountKobo && data.amount !== order.paystackAmountKobo) {
        console.log(`Paystack amount mismatch for order ${orderId}: expected ${order.paystackAmountKobo}, got ${data.amount}`);
        return res.json({ success: false, message: "Payment verification failed" });
      }

      if (!order.payment) {
        await orderModel.findByIdAndUpdate(orderId, { payment: true });
      }
      if (userId) {
        await userModel.findByIdAndUpdate(userId, { cartData: {} });
      }

      res.json({ success: true, message: "Payment confirmed" });
    } else {
      const order = await orderModel.findById(orderId);
      if (order && !order.payment) {
        await orderModel.findByIdAndDelete(orderId);
      }
      res.json({ success: false, message: "Payment not successful" });
    }
  } catch (error) {
    console.log(error?.response?.data || error);
    res.json({ success: false, message: error.message });
  }
};


const paystackWebhook = async (req, res) => {
  try {
    if (!req.rawBody) {
      console.log("Missing rawBody - check that express.json() captures it (see server setup notes)");
      return res.sendStatus(500);
    }

    const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(req.rawBody).digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.sendStatus(401);
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const { reference, metadata } = event.data;
      const orderId = metadata?.orderId;
      const userId = metadata?.userId;

      if (orderId) {
        const order = await orderModel.findById(orderId);

        if (order && !order.payment) {
          await orderModel.findByIdAndUpdate(orderId, { payment: true });

          if (userId) {
            await userModel.findByIdAndUpdate(userId, { cartData: {} });
          }
        }
      } else {
        console.log("Paystack webhook: no orderId in metadata for reference", reference);
      }
    }


    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
};

export {
  placeOrder,
  placeOrderStripe,
  placeOrderPaystack,
  placeOrderRazorpay,
  allOrders,
  userOrders,
  updateStatus,
  verifyStripePayment,
  verifyPaystack,
  paystackWebhook,
};