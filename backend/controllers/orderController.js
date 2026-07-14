import crypto from "crypto";
import axios from "axios";
import Stripe from "stripe";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";

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

    const newOrder = new orderModel(orderData);
    await newOrder.save();

    const line_items = items.map((item) => ({
      price_data: {
        currency: currency,
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100), 
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


const placeOrderPaystack = async (req, res, next) => {
  try {
    const { userId, address, amount, items } = req.body;
    const { origin } = req.headers;

    if (!address?.email) {
      return res.json({ success: false, message: "Email is required for Paystack payment" });
    }

    const orderData = {
      items,
      address,
      amount,
      userId,
      paymentMethod: "paystack",
      payment: false,
      date: Date.now(),
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save();


    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: address.email,
        amount: Math.round(amount * 100),
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

      if (order && order.payment === true) {
        await userModel.findByIdAndUpdate(userId, { cartData: {} });
        res.json({ success: true, message: "Payment confirmed" });
      } else if (order) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const updatedOrder = await orderModel.findById(orderId);

        if (updatedOrder && updatedOrder.payment === true) {
          await userModel.findByIdAndUpdate(userId, { cartData: {} });
          res.json({ success: true, message: "Payment confirmed" });
        } else {
          res.json({ success: false, message: "Payment pending" });
        }
      } else {
        res.json({ success: false, message: "Order not found" });
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

      if (order && !order.payment) {
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