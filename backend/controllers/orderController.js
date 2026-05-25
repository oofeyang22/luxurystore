import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import Stripe from "stripe";

const currency = "usd";
const delivery_charge = 49;

//GATEWAY INITIALIZE
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


//order using COD
const placeOrder = async (req, res, next) => {
  try {
    const { userId, address, amount, items } = req.body;

    const orderData = {items,address,amount,userId,paymentMethod: "COD",payment: false,date: Date.now(),};

    const newOrder = new orderModel(orderData)
    await newOrder.save()

    await userModel.findByIdAndUpdate(userId, { cartData: {} });

    res.json({success:true , message: "Order Placed"}) 
  } catch (error) {
    console.log(error);
    res.json({success:false,message:error.message})
    
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
        unit_amount: Math.round(item.price * 100), // Ensure integer
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
        userId: userId
      }
    });

    res.json({ success: true, session_url: session.url, sessionId: session.id });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


//place order using razorpay
const placeOrderRazorpay = async (req, res, next) => {
  try {
  } catch (error) {
    next(error);
  }
};

//All orders for admin panel
const allOrders = async (req, res, next) => {
  try {
    const orders = await orderModel.find({});
    res.json({success:true,orders})
  } catch (error) {
    console.log(error);
    res.json({success:false,message: error.message})
  }
};
//user order data for frontend
const userOrders = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const orders = await orderModel.find({ userId });
    res.json({success:true,orders})
  } catch (error) {
    console.log(error);
    res.json({success:false,message: error.message})
    
  }
};


//update order status from admin panel
const updateStatus = async (req, res, next) => {
  try {
    const { orderId, status } = req.body;

    await orderModel.findByIdAndUpdate(orderId, { status });
    res.json({success:true,message:"Status updated"})
  } catch (error) {
    console.log(error);
    res.json({success:false,message: error.message})
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
        await new Promise(resolve => setTimeout(resolve, 3000));
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

export {
  placeOrder,
  placeOrderStripe,
  placeOrderRazorpay,
  allOrders,
  userOrders,
  updateStatus,
  verifyStripePayment,
};