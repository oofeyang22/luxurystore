// controllers/stripeWebhook.js
import Stripe from "stripe";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.log(`Webhook error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { orderId, userId } = session.metadata;
    
    try {
      await orderModel.findByIdAndUpdate(orderId, {
        payment: true,
        paymentIntentId: session.payment_intent,
        status: 'Confirmed'
      });
      
      await userModel.findByIdAndUpdate(userId, { cartData: {} });
      console.log(`Payment confirmed for order ${orderId}`);
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
  }
  
  res.json({ received: true });
};