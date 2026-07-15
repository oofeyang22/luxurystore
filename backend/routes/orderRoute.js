import express from "express";
import {
  allOrders,
  placeOrder,
  placeOrderPaystack,
  placeOrderRazorpay,
  placeOrderStripe,
  updateStatus,
  userOrders,
  verifyPaystack,
  verifyStripePayment,
  paystackWebhook,
} from "../controllers/orderController.js";
import authUser from "../middleware/Auth.js";
import adminAuth from "../middleware/adminAuth.js";

const orderRouter = express.Router();


orderRouter.post("/list", adminAuth, allOrders);
orderRouter.post("/status", adminAuth, updateStatus);


orderRouter.post("/place", authUser, placeOrder);
orderRouter.post("/stripe", authUser, placeOrderStripe);
orderRouter.post("/paystack", authUser, placeOrderPaystack);
orderRouter.post("/razorpay", authUser, placeOrderRazorpay);


orderRouter.post("/userorders", authUser, userOrders);


orderRouter.post("/verifystripe", authUser, verifyStripePayment);
orderRouter.post("/verifypaystack", authUser, verifyPaystack);


orderRouter.post("/paystack-webhook", paystackWebhook);


export default orderRouter;