import validator from "validator";
import bcrypt from "bcrypt";
import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

const createToken =(id) =>{
  return jwt.sign({id},process.env.JWT_SECRET)
}


const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;


    const existUser = await userModel.findOne({ email });
    if (existUser) {
      return res.json({success:false, message:"User already Registered"})
    }


    if (!validator.isEmail(email)) {
      return res.json({success:false, message:"Please enter a valid email"})
    }
    
    if (password.length < 8) {
      return res.json({success:false, message:"Password must be 8char+ "})
    }


    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    const newUser = await userModel.create({
      name,
      email,
      password: hashPassword,
    });

    const user = await newUser.save()
    

    const token = createToken(user._id);
    res.json({success:true,token})
  } catch (error) {
    console.log(error);
    res.json({success:false, message: error.message})
    
  }
   
}


const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });

    if (!user) {
      return res.json({success:false, message:"User does not exist"})
    }

    const isMatch = await  bcrypt.compare(password, user.password);

    if (isMatch) {
      const token = createToken(user._id);
      res.json({success:true, token})
    }
    else{
      res.json({success:false, message:"Invalid Credentials"})
    }

  } catch (error) {
    res.json({success:false,message : error.message})
  }
};


const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign(email + password, process.env.JWT_SECRET);
      res.json({success:true,token})
    }
    else{
      res.json({success:false,message:"invalid Credentials"})
    }
  } catch (error) {
    res.json({success:false,message : error.message})
  }
};


const getProfile = async (req, res) => {
  try {
    const user = await userModel.findById(req.body.userId).select("-password");
    if (!user) return res.json({ success: false, message: "User not found" });
    res.json({ success: true, user });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};


const updateProfile = async (req, res) => {
  try {
    const { userId, name, email } = req.body;
    const imageFile = req.file;

    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;

    // Upload profile image to Cloudinary
    if (imageFile) {
      const uploadFromBuffer = () =>
        new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "profile_pictures",
              transformation: [
                {
                  width: 300,
                  height: 300,
                  crop: "fill",
                  gravity: "face",
                },
              ],
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );

          streamifier
            .createReadStream(imageFile.buffer)
            .pipe(uploadStream);
        });

      const result = await uploadFromBuffer();

      updateData.profilePicture = result.secure_url;
      updateData.profilePictureId = result.public_id;
    }

    const updatedUser = await userModel
      .findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      })
      .select("-password");

    if (!updatedUser) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};


const deleteAccount = async (req, res) => {
  try {
    const { userId } = req.body;
    await userModel.findByIdAndDelete(userId);
    // Optionally: also delete their orders, cart, etc.
    res.json({ success: true, message: "Account deleted" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

const deactivateAccount = async (req, res) => {
  try {
    const { userId } = req.body;
    await userModel.findByIdAndUpdate(userId, { isActive: false });
    res.json({ success: true, message: "Account deactivated" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export { registerUser, loginUser, adminLogin, getProfile, updateProfile, deleteAccount, deactivateAccount };