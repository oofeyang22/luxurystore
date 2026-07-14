import express from "express";
import upload from "../middleware/multer.js";
import { loginUser, registerUser, adminLogin, getProfile, updateProfile, deleteAccount, deactivateAccount } from "../controllers/userController.js";
import authUser from "../middleware/Auth.js";



const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/admin", adminLogin);
userRouter.post("/profile", authUser, getProfile);
userRouter.put("/profile", authUser, upload.single("image"), updateProfile);
userRouter.delete("/profile", authUser, deleteAccount);
userRouter.patch("/deactivate", authUser, deactivateAccount);

export default userRouter;