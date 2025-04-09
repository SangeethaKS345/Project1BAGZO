const mongoose = require('mongoose'); 
const User = require("../../models/userSchema");
const dotenv = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema"); 
const Brand = require("../../models/brandSchema");
const Wallet = require("../../models/walletSchema");

// Helper functions
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify Your Account",
            text: `Your OTP is ${otp}`,
        });
        console.log("OTP sent to email:", email, otp);
        return { success: true, message: "Email sent successfully" };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, message: error.message };
    }
};

const securePassword = async (password) => {
    try {
        return await bcrypt.hash(password, 10);
    } catch (error) {
        console.error("Password hashing failed:", error);
        return false;
    }
};

const generateReferralCode = async () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let referralCode;
    let isUnique = false;

    while (!isUnique) {
        referralCode = '';
        for (let i = 0; i < 8; i++) {
            referralCode += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        const existingUser = await User.findOne({ referralCode });
        if (!existingUser) {
            isUnique = true;
        }
    }
    console.log("Generated referral code:", referralCode);
    return referralCode;
};

const calculateEffectivePrice = (product, currentDate) => {
    let effectivePrice = product.salesPrice; // Start with salesPrice
    let offerPercentage = 0;
    let offerType = '';

    // Check for product offer
    if (product.productOffer > 0 && (!product.offerEndDate || product.offerEndDate > currentDate)) {
        const productDiscount = product.salesPrice * (product.productOffer / 100);
        effectivePrice -= productDiscount; // Subtract product offer discount from salesPrice
        offerPercentage = product.productOffer;
        offerType = 'product';
    }

    // Check for category offer and apply the higher discount
    if (
        product.category?.categoryOffer > 0 &&
        (!product.category.offerEndDate || product.category.offerEndDate > currentDate)
    ) {
        const categoryDiscount = product.salesPrice * (product.category.categoryOffer / 100);
        if (product.category.categoryOffer > offerPercentage) {
            effectivePrice = product.salesPrice - categoryDiscount; // Subtract category offer discount from salesPrice
            offerPercentage = product.category.categoryOffer;
            offerType = 'category';
        }
    }

    return {
        ...product._doc,
        effectivePrice: Math.round(effectivePrice), // Round to avoid decimal issues
        offerPercentage,
        offerType
    };
};

const loadHomepage = async (req, res, next) => {
    console.log(req.session.user, "user session in loadHomepage");
    try {
        const user = req.session.user;
        const [categories, brand] = await Promise.all([
            Category.find({ isListed: true }),
            Brand.find({ isBlocked: false })
        ]);

        const productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            brand: { $in: brand.map(brand => brand._id) }
        })
        .populate('category')
        .sort({ createdAt: -1 })
        .limit(8); // Limit to 8 products

        const currentDate = new Date();
        const productsWithOffers = productData.map(product => calculateEffectivePrice(product, currentDate));

        let userData = null;
        if (user && user.id) {
            userData = await User.findById(user.id);
            console.log("User Data for rendering:", userData);
        }

        return res.render("home", { 
            userData, 
            products: productsWithOffers, 
            categories, 
            brand 
        });
    } catch (error) {
        next(error);
    }
};

const loadSignup = (req, res, next) => {
    try {
        return res.render('signup', { message: "" });
    } catch (error) {
        next(error);
    }
};

const signup = async (req, res, next) => {
    try {
        const { name, phone, email, password, cPassword, referralCode } = req.body;

        if (!name || !phone || !email || !password || !cPassword) {
            return res.redirect(`/signup?action=signup&form=signup&message=${encodeURIComponent("All fields are required")}`);
        }

        if (password !== cPassword) {
            return res.redirect(`/signup?action=signup&form=signup&message=${encodeURIComponent("Passwords do not match")}`);
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.redirect(`/signup?action=signup&form=signup&message=${encodeURIComponent("Email already exists. Please use a different email address or try logging in.")}`);
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent.success) {
            return res.redirect(`/signup?action=signup&form=signup&message=${encodeURIComponent("Failed to send OTP. Try again")}`);
        }

        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password, referralCode };
        res.render("verifyOtp");
    } catch (error) {
        console.error("Error in signup:", error);
        res.redirect(`/signup?action=signup&form=signup&message=${encodeURIComponent("An error occurred. Please try again.")}`);
    }
};

const checkReferralCode = async (req, res, next) => {
    try {
        const { referralCode } = req.body;
        const referrer = await User.findOne({ referralCode });
        
        if (referrer && !referrer.redeemed) {
            return res.json({ success: true, message: "Valid referral code" });
        }
        return res.json({ success: false, message: "Invalid or already used referral code" });
    } catch (error) {
        console.error("Error checking referral code:", error);
        return res.json({ success: false, message: "Error checking referral code" });
    }
};

const verifyOtp = async (req, res, next) => {
    try {
        const { otp } = req.body;
        if (!req.session.userOtp || req.session.userOtp !== otp) {
            return res.json({ success: false, message: "Invalid or expired OTP" });
        }
        const { name, phone, email, password, referralCode } = req.session.userData;
        const hashedPassword = await securePassword(password);
        const userReferralCode = await generateReferralCode();
        console.log("Generated referral code for new user:", userReferralCode);

        const newUser = new User({ 
            name, 
            phone, 
            email, 
            password: hashedPassword,
            referralCode: userReferralCode 
        });
        await newUser.save();
        console.log("Saved new user with referral code:", newUser.referralCode);

        const newWallet = new Wallet({
            user: newUser._id,
            balance: 0,
            transactions: []
        });
        await newWallet.save();
        console.log("New user wallet created:", newWallet);

        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (referrer) { 
                newWallet.balance += 500;
                newWallet.transactions.push({
                    type: 'credit',
                    amount: 500,
                    description: 'Referral bonus for signing up',
                    date: new Date()
                });
                await newWallet.save();
                console.log("New user wallet after referral bonus:", newWallet);

                let referrerWallet = await Wallet.findOne({ user: referrer._id });
                if (!referrerWallet) {
                    referrerWallet = new Wallet({ 
                        user: referrer._id, 
                        balance: 0, 
                        transactions: [] 
                    });
                }
                referrerWallet.balance += 500;
                referrerWallet.transactions.push({
                    type: 'credit',
                    amount: 500,
                    description: `Referral bonus for referring ${newUser.name}`,
                    date: new Date()
                });
                await referrerWallet.save();
                console.log("Referrer wallet after referral bonus:", referrerWallet);
            } else {
                console.log("Invalid referral code provided:", referralCode);
            }
        } else {
            console.log("No referral code provided during signup");
        }

        req.session.user = {
            id: newUser._id.toString(),
            name: newUser.name,
            email: newUser.email
        };

        req.session.userOtp = null;
        req.session.userData = null;

        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.json({ success: false, message: "Session error" });
            }
            console.log(`Sign up verification OTP: ${otp}`);
            return res.json({ success: true, redirectUrl: "/" });
        });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        next(error);
    }
};

const pageNotFound = (req, res, next) => {
    try {
        res.status(404).render("404");
    } catch (error) {
        next(error); 
    }
};

const loadLogin = (req, res, next) => {
    try {
        if (!req.session.user) {
            return res.render("signin");
        }
        return res.redirect("/");
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        console.log("User login route hit");
        const { email, password } = req.body;

        if (!email || !password) {
            return res.redirect("/signin?message=" + encodeURIComponent("Email and password are required"));
        }

        const user = await User.findOne({ email, isAdmin: false });
        if (!user) {
            return res.redirect("/signin?message=" + encodeURIComponent("Email not found. Please sign up."));
        }

        if (user.isBlocked) {
            return res.redirect("/signin?message=" + encodeURIComponent("Your account is blocked. Contact support."));
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.redirect("/signin?message=" + encodeURIComponent("Incorrect password."));
        }

        req.session.user = { id: user._id, name: user.name };
        res.redirect("/");
    } catch (error) {
        console.error("User Login Error:", error);
        next(error);
    }
};

const resendOtp = async (req, res) => {
    try {
        if (!req.session.userData || !req.session.userData.email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(req.session.userData.email, otp);
        if (emailSent.success) {
            console.log("Resent OTP:", otp);
            return res.status(200).json({ success: true, message: "OTP resent successfully" });
        }

        return res.status(500).json({ success: false, message: "Failed to resend OTP. Try again" });
    } catch (error) {
        console.error("Error resending OTP:", error);
        res.status(500).json({ success: false, message: "Internal server error. Try again" });
    }
};

const logout = async (req, res, next) => {
    try {
        req.session.user = null;
        res.redirect("/signin");
    } catch (error) {
        console.error("Logout error:", error);
        next(error); 
    }
};

const forgotPassword = (req, res) => {
    try {
        return res.render("forgotPassword");
    } catch (error) {
        console.error('Forgot password page rendering error', error);
        res.redirect("/pageNotFound");
    }
};

const forgotPasswordSendLink = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const user = await User.findOne({ email, isAdmin: false });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const otp = generateOtp();
        console.log('OTP : ', otp );
        user.forgotPasswordOtp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        // Use NodeMailer to send the OTP email
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Reset Your Password",
            text: `Your OTP for password reset is ${otp}. It will expire in 10 minutes.`,
        });

        req.session.user = email;
        res.json({ success: true, message: "OTP sent to email" });
    } catch (error) {
        console.error("Error in forgot password:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const newPassword = (req, res) => {
    try {
        return res.render("newPassword");
    } catch (error) {
        console.error('New password page rendering error', error);
        res.redirect("/pageNotFound");
    }
};

const changePassword = async (req, res) => {
    try {
        const passwordHash = await bcrypt.hash(req.body.password, 10);
        await User.updateOne({ email: req.session.user }, { password: passwordHash });
        req.session.user = null;
        res.json({ success: "Successfully changed the password" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const loadShop = async (req, res, next) => {
    try {
        let userData = null;
        if (req.session.user && req.session.user.id) {
            userData = await User.findById(req.session.user.id);
        }

        const { email, name } = req.user;
        const existingUser = await User.findOne({ email });

        if (!existingUser) {
            req.session.flashMessage = "No account found with this Gmail address. Please sign up first.";
            return res.redirect("/signup?form=signin");
        }

        if (existingUser.isBlocked) {
            req.session.flashMessage = "Your account is blocked. Please contact support.";
            return res.redirect("/signup?form=signin");
        }

        req.session.user = {
            id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email
        };

        const [categories, brands] = await Promise.all([
            Category.find({ isListed: true }), 
            Brand.find({ isBlocked: false })
        ]);

        const filter = {
            isBlocked: false,
            status: "Available",
            category: { $in: categories.map(cat => cat._id) },
            brand: { $in: brands.map(brand => brand._id) }
        };

        const products = await Product.find(filter)
            .sort({ createdAt: -1 })
            .populate('category')
            .populate('brand');

        res.render('shop', {
            products,
            categories,
            brands,
            query: req.query,
            userData,
            isLoggedIn: !!req.session.user
        });
    } catch (error) {
        next(error); 
    }
};

const handleGoogleAuth = async (req, res, next) => {
    try {
        const userId = req.user._id;
        let existingUser = await User.findOne({ _id: userId });

        if (!existingUser) {
            const userReferralCode = await generateReferralCode();
            const newUser = new User({
                name: req.user.displayName,
                email: req.user.emails[0].value,
                googleId: req.user.id,
                referralCode: userReferralCode
            });
            await newUser.save();

            const newWallet = new Wallet({
                user: newUser._id,
                balance: 0
            });
            await newWallet.save();

            req.session.user = {
                id: newUser._id.toString(),
                name: newUser.name
            };
        } else {
            if (existingUser.isBlocked) {
                req.session.flashMessage = "Your account is blocked. Contact support.";
                return res.redirect("/signup?form=signin");
            }

            req.session.user = {
                id: existingUser._id.toString(),
                name: existingUser.name
            };
        }

        res.redirect("/");
    } catch (error) {
        console.error("Google Auth Error:", error);
        req.session.flashMessage = "Authentication failed. Please try again.";
        return res.redirect("/signup");
    }
};

// Export Routes
module.exports = {
    loadHomepage,
    loadSignup,
    signup,
    sendVerificationEmail,
    verifyOtp,
    resendOtp,
    pageNotFound,
    loadLogin,
    login,
    logout,
    forgotPassword,
    forgotPasswordSendLink,
    newPassword,
    changePassword,
    loadShop,
    handleGoogleAuth
};