const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Helper function to generate OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Helper function to send verification email
const sendVerificationEmail = async (email, otp) => {
    try {
        console.log(`OTP for ${email}: ${otp}`);
        return true;
    } catch (error) {
        console.error('Error in sendVerificationEmail:', error);
        return false;
    }
};

// Helper function to hash password
const securePassword = (password) => bcrypt.hash(password, 10);

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only images (JPG, PNG) are allowed!'));
    }
}).single('profileImage');

// Controller functions
const getForgotPassword = (req, res) => res.render("forgot-password");

const forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email });
        if (findUser) {
            const otp = generateOtp();
            if (await sendVerificationEmail(email, otp)) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgotPassword-otp");
                console.log("Forgot Password OTP:", otp);
            } else {
                res.json({ success: false, message: "Failed to generate OTP. Please try again" });
            }
        } else {
            res.render("forgot-password", { message: "User with this email does not exist" });
        }
    } catch (error) {
        console.error("Error in forgotEmailValid:", error);
        res.redirect("/pageNotFound");
    }
};

const verifyForgotPassOtp = (req, res) => {
    const otpInput = req.body.otpInput.trim();
    if (otpInput !== req.session.userOtp) {
        return res.json({ message: "OTP not matching" });
    }
    return res.json({ success: "OTP Verified Successfully" });
};

const getResetPassword = (req, res) => res.render("reset-password");

const resendOtp = async (req, res) => {
    try {
        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        if (await sendVerificationEmail(email, otp)) {
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
            await User.updateOne({ email }, { $set: { password: passwordHash } });
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
        const userData = req.user;
        if (!userData) return res.redirect("/login");
        res.render("profile", { userData, user: userData });
    } catch (error) {
        console.error("Profile Controller Error:", error);
        res.redirect("/pageNotFound");
    }
};

const getEditProfile = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user.id) return res.redirect("/login");
        const userId = req.session.user.id;
        const userData = await User.findById(userId);
        if (!userData) return res.status(404).send("User not found");
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
        if (existingUser) return res.status(400).json({ error: "Email already in use by another account" });
        const otp = generateOtp();
        req.session.emailOtp = otp;
        req.session.newEmail = email;
        if (await sendVerificationEmail(email, otp)) {
            res.status(200).json({ success: true, message: "OTP logged to console" });
        } else {
            res.status(500).json({ error: "Failed to generate OTP" });
        }
    } catch (error) {
        console.error("Error in sendEmailOtp:", error);
        res.status(500).json({ error: "Server error" });
    }
};

const verifyEmailOtp = (req, res) => {
    const { otp } = req.body;
    if (otp !== req.session.emailOtp) return res.status(400).json({ error: "Invalid OTP" });
    req.session.emailVerified = true;
    res.status(200).json({ success: true, message: "Email verified successfully" });
};

const updateEditProfile = async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.log('Multer error:', err);
            return res.status(400).json({ error: err.message });
        }
        try {
            const userId = req.session.user?.id;
            if (!userId) throw new Error("Unauthorized, please log in.");
            
            const user = await User.findById(userId);
            if (!user) throw new Error("User not found.");

            const { name, phone, email, currentpassword, NewPassword, Cpassword } = req.body;

            // ... email verification and password logic ...

            if (req.file) {
                // Delete old image if it exists and isn't the default
                if (user.profileImage && !user.profileImage.includes('default-profile')) {
                    const oldImagePath = path.join(__dirname, '../../public/uploads/', path.basename(user.profileImage));
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                    }
                }
                user.profileImage = '/uploads/' + req.file.filename;
            }

            if (name) user.name = name;
            if (phone) user.phone = phone;
            if (email && email !== user.email && req.session.emailVerified) {
                user.email = email;
                delete req.session.emailVerified;
                delete req.session.emailOtp;
                delete req.session.newEmail;
            }

            await user.save();
            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Update profile error:', error);
            res.status(error.status || 500).json({ error: error.message || "Server error" });
        }
    });
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