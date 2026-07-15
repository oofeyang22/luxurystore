import express from "express"
import cors from "cors";
import "dotenv/config"
import connectDB from "./config/mongodb.js";
import connectCloudinary from "./config/cloudinary.js";
import userRouter from "./routes/userRoute.js";
import productRouter from "./routes/productRoute.js";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import { stripeWebhook } from "./controllers/stripewebhook.js";


const app = express();
const port = process.env.PORT || 4000;


connectDB()
connectCloudinary()

app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), stripeWebhook);

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));


app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://luxurystore-7d5q.vercel.app',
    'https://luxurystore-dqwe.vercel.app'
  ],
  credentials: true
}))


app.use('/api/user',userRouter)
app.use('/api/product',productRouter)
app.use("/api/cart",cartRouter)
app.use("/api/order",orderRouter)

app.get("/",(req,res)=>{
    res.send("API working")
})

app.listen(port,()=>{
    console.log(`Server started on PORT: ${port}`);
    
})

export default app;
