const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const mongoose = require("mongoose");





const getForgotPassword = async (req, res) => {
  try {
    res.render("forgot-password");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const forgotEmailValid = async (req, res) => {
  try {
    const { email } = req.body;
    const findUser = await User.findOne({ email: email });
    if (findUser) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
        req.session.userOtp = otp;
        req.session.email = email;

        res.render("forgotPassword-otp");

        console.log("OTP:", otp);
      } else {
        res.json({
          success: false,
          message: "Failed to send OTP. please try again",
        });
      }
    } else {
      res.render("forgot-password", {
        message: "User with this email does not exist",
      });
    }
  } catch (error) {
    console.error("Error in forgotEmailValid:", error);
    res.redirect("/pageNotFound");
  }
};

const verifyForgotPassOtp = async (req, res) => {
  try {
    //console.log(req.body)
    //console.log(req.session.userOtp)
    const otpInput = req.body.otpInput.trim();
    if (otpInput != req.session.userOtp) {
      return res.json({ message: "OTP not matching" });
    }

    return res.json({ success: "OTP Verified SuccessFully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "an error occured, please try again" });
  }
};

const getResetPassword = async (req, res) => {
  try {
    res.render("reset-password");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const resendOtp = async (req, res) => {
  try {
    const otp = generateOtp();
    req.session.userOtp = otp;
    const email = req.session.email;
    console.log("Resending otp to email", email);
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("resend otp", otp);
      res.status(200).json({ success: true, message: "resend otp successful" });
    }
  } catch (error) {
    console.error("error in resend otp", error);
    res.status(500).json({ success: false, message: "internal server error" });
  }
};

const postNewPassword = async (req, res) => {
  try {
    const { newPass1, newPass2 } = req.body;
    const email = req.session.email;
    if (newPass1 === newPass2) {
      const passwordHash = await securePassword(newPass1);
      await User.updateOne(
        { email: email },
        { $set: { password: passwordHash } }
      );
      res.redirect("/login");
    } else {
      res.render("reset-password", { message: "passwords do not match" });
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const userProfile = async (req, res) => {
  try {
    console.log("UserProfile Controller Called");
    console.log("Request User:", req.user);
    console.log("Request User ID:", req.userId);
    console.log("Locals User:", res.locals.user);

    // If using req.user from middleware
    const userData = req.user;

    if (!userData) {
      console.log("No user data found");
      return res.redirect("/login");
    }

    res.render("profile", { 
      userData: userData,
      user: userData  // Provide multiple options for EJS template
    });
  } catch (error) {
    console.error("Profile Controller Error:", error);
    res.redirect("/pageNotFound");
  }
};


const getEditProfile = async (req, res) => {
  try {
    console.log("session user:", req.session.user);
    if (!req.session.user || !req.session.user.id) {
      console.log("User not logged in, redirecting to login.");
      return res.redirect("/login");
    }
    const userId = req.session.user.id;

    const userData = await User.findById(userId);
    if (!userData) {
      return res.status(404).send("User not found");
    }
    
    // Removed the problematic line that was causing the error
    console.log("Rendering user/editProfile with user:", userData);
    res.render("editProfile", { user: userData });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};

const updateEditProfile = async (req, res, next) => {
  try {
    const userId = req.session.user.id; // Use id, not _id
    if (!userId) {
      const error = new Error("Unauthorized, please log in.");
      error.status = 401;
      throw error;
    }

    const { name, phone, currentpassword, NewPassword, Cpassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      const error = new Error("User not found.");
      error.status = 404;
      throw error;
    }

    if (currentpassword || NewPassword || Cpassword) {
      if (!currentpassword || !NewPassword || !Cpassword) {
        const error = new Error("All password fields are required.");
        error.status = 400;
        throw error;
      }

      if (user.googleId && !user.password) {
        const error = new Error("Password change is not allowed for Google login users.");
        error.status = 400;
        throw error;
      }

      const passwordMatch = await bcrypt.compare(currentpassword, user.password);
      if (!passwordMatch) {
        const error = new Error("Current password is incorrect.");
        error.status = 401;
        throw error;
      }

      if (NewPassword !== Cpassword) {
        const error = new Error("New password and confirm password do not match.");
        error.status = 400;
        throw error;
      }

      user.password = await bcrypt.hash(NewPassword, 10);
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;

    await user.save();

    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};



module.exports = {
  getForgotPassword,
  forgotEmailValid,
  verifyForgotPassOtp,
  getResetPassword,
  resendOtp,
  postNewPassword,
  userProfile,
  //getAccount,
  getEditProfile,
 // updateAccount,
 updateEditProfile,

};