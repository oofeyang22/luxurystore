import express from "express";
import multer from "multer";
import { loginUser, registerUser, adminLogin, getProfile, updateProfile, deleteAccount, deactivateAccount } from "../controllers/userController.js";
import authUser from "../middleware/Auth.js";

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/admin", adminLogin);
userRouter.post("/profile", authUser, getProfile);
userRouter.put("/profile", authUser, upload.single("image"), updateProfile);
userRouter.delete("/profile", authUser, deleteAccount);
userRouter.patch("/deactivate", authUser, deactivateAccount);

export default userRouter;