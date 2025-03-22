const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
require('dotenv').config(); 
const session = require("express-session");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const mongoose = require("mongoose");
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images (JPG, PNG) are allowed!'));
    }
}).single('profileImage');

// Helper function to generate OTP
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};


const sendVerificationEmail = async (email, otp) => {
    try {
        console.log(`OTP for ${email}: ${otp}`); // Log OTP to console
        return true; // Simulate successful "sending"
    } catch (error) {
        console.error('Error in sendVerificationEmail:', error);
        return false;
    }
};

// Helper function to hash password
const securePassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

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
                console.log("Forgot Password OTP:", otp);
            } else {
                res.json({
                    success: false,
                    message: "Failed to generate OTP. Please try again",
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
        const otpInput = req.body.otpInput.trim();
        if (otpInput !== req.session.userOtp) {
            return res.json({ message: "OTP not matching" });
        }
        return res.json({ success: "OTP Verified Successfully" });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "An error occurred, please try again" 
        });
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
        console.log("Resending OTP to email", email);
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Resend OTP:", otp);
            res.status(200).json({ success: true, message: "Resend OTP successful" });
        }
    } catch (error) {
        console.error("Error in resendOtp:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
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
            res.render("reset-password", { message: "Passwords do not match" });
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const userProfile = async (req, res) => {
    try {
        console.log("UserProfile Controller Called");
        const userData = req.user;
        if (!userData) {
            console.log("No user data found");
            return res.redirect("/login");
        }
        console.log("User Data:", userData);
        res.render("profile", { 
            userData: userData,
            user: userData
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
        
        console.log("Rendering user/editProfile with user:", userData);
        res.render("editProfile", { user: userData });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};

const sendEmailOtp = async (req, res) => {
    try {
        const { email } = req.body;
        const userId = req.session.user.id;
        
        const existingUser = await User.findOne({ email, _id: { $ne: userId } });
        if (existingUser) {
            return res.status(400).json({ error: "Email already in use by another account" });
        }

        const otp = generateOtp();
        req.session.emailOtp = otp;
        req.session.newEmail = email;
        
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Email verification OTP:", otp);
            res.status(200).json({ success: true, message: "OTP logged to console" });
        } else {
            res.status(500).json({ error: "Failed to generate OTP" });
        }
    } catch (error) {
        console.error("Error in sendEmailOtp:", error);
        res.status(500).json({ error: "Server error" });
    }
};

const verifyEmailOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        if (otp !== req.session.emailOtp) {
            return res.status(400).json({ error: "Invalid OTP" });
        }
        
        req.session.emailVerified = true;
        res.status(200).json({ success: true, message: "Email verified successfully" });
    } catch (error) {
        console.error("Error in verifyEmailOtp:", error);
        res.status(500).json({ error: "Server error" });
    }
};

const updateEditProfile = async (req, res, next) => {
    try {
        upload(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }

            const userId = req.session.user.id;
            if (!userId) {
                const error = new Error("Unauthorized, please log in.");
                error.status = 401;
                throw error;
            }

            const { name, phone, email, currentpassword, NewPassword, Cpassword } = req.body;
            const user = await User.findById(userId);
            
            if (!user) {
                const error = new Error("User not found.");
                error.status = 404;
                throw error;
            }

            // Handle email update
            if (email && email !== user.email) {
                if (!req.session.emailVerified || req.session.newEmail !== email) {
                    const error = new Error("Please verify the new email address first.");
                    error.status = 400;
                    throw error;
                }
            }

            // Handle password update
            if (currentpassword || NewPassword || Cpassword) {
                if (!currentpassword || !NewPassword || !Cpassword) {
                    const error = new Error("All password fields are required.");
                    error.status = 400;
                    throw error;
                }

                if (user.googleId && !user.password) {
                    const error = new Error("Password change not allowed for Google login users.");
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
                    const error = new Error("New passwords do not match.");
                    error.status = 400;
                    throw error;
                }

                user.password = await bcrypt.hash(NewPassword, 10);
            }

            // Update fields
            if (name) user.name = name;
            if (phone) user.phone = phone;
            if (email && email !== user.email && req.session.emailVerified) {
                user.email = email;
                delete req.session.emailVerified;
                delete req.session.emailOtp;
                delete req.session.newEmail;
            }
            if (req.file) {
                if (user.profileImage && user.profileImage !== 'default-profile.jpg') {
                    const oldImagePath = path.join(__dirname, '../../public/uploads/', user.profileImage);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                    }
                }
                user.profileImage = req.file.filename;
            }

            await user.save();
            return res.status(200).json({ success: true });
        });
    } catch (error) {
        console.error("Error in updateEditProfile:", error);
        res.status(error.status || 500).json({ error: error.message || "Server error" });
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
    getEditProfile,
    updateEditProfile,
    sendEmailOtp,
    verifyEmailOtp
};