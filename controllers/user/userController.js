const mongoose = require('mongoose'); 
const User = require("../../models/userSchema");
const dotenv = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema"); 
const Brand = require("../../models/brandSchema");

// Load Home Page
const loadHomepage = async (req, res, next) => {
    try {
        const user = req.session.user;

        console.log("user in session", user)
        // Fetch categories and brands
        const categories = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });

        // Fetch products with sorting directly in the query
        const productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            brand: { $in: brand.map(brand => brand._id) }
        }).sort({ createdAt: -1 });

        //console.log(productData);

        if (user) {
            const userData = await User.findById(req.session.user.id);
            return res.render("home", { userData, products: productData, categories, brand });
        } else {
            return res.render("home", { products: productData, userData: "", categories, brand });
        }
    } catch (error) {
        next(error);  // Pass error to errorHandler
    }
};



// Load Signup Page
const loadSignup = async (req, res, next) => {
    try {
        return res.render('signup', { message: "" }); // Ensuring 'message' is always passed
    } catch (error) {
        next(error); 
    }
};


// Generate a 6-digit OTP
const generateOtp = () => {
    return String(Math.floor(100000 + Math.random() * 900000)); // Ensures it's always a 6-digit string
};

// Send OTP via Email
const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify Your Account",
            text: `Your OTP is ${otp}`,
        });

        return { success: true, message: "Email sent successfully" };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, message: error.message };
    }
};


// Secure password hashing
const securePassword = async (password) => {
    try {
        return await bcrypt.hash(password, 10);
    } catch (error) {
        console.error("Password hashing failed:", error);
        return false;
    }
};


// Signup Handler
const signup = async (req, res, next) => {
    try {
        const { name, phone, email, password, cPassword } = req.body;

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

        // Generate OTP and store it in session
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.redirect(`/signup?action=signup&form=signup&message=${encodeURIComponent("Failed to send OTP. Try again")}`);
        }

        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password };

        res.render("verifyOtp");
    } catch (error) {
        console.error("Error in signup:", error);
        res.redirect(`/signup?action=signup&form=signup&message=${encodeURIComponent("An error occurred. Please try again.")}`);
    }
};





// Verify OTP
const verifyOtp = async (req, res, next) => {
    try {
        const { otp } = req.body;

        if (!req.session.userOtp || req.session.userOtp !== otp) {
            return res.json({ success: false, message: "Invalid or expired OTP" });
        }

        // Retrieve user data from session and hash the password
        const { name, phone, email, password } = req.session.userData;
        const hashedPassword = await securePassword(password);

        if (!hashedPassword) {
            return res.json({ success: false, message: "Error hashing password" });
        }

        // Save new user in the database
        const newUser = new User({ name, phone, email, password: hashedPassword });
        await newUser.save();

        req.session.user = {
            _id: newUser._id.toString(),
            name: newUser.name,
            email: newUser.email
        };

        // Clear session
        req.session.userOtp = null;
        req.session.userData = null;
        req.session.save();

        console.log(`Sign up verification OTP :  ${otp}`);
        return res.json({ success: true, redirectUrl: "/" });
   
    } catch (error) {
        console.error("Error verifying OTP:", error);
        next(error); 
    }
};




// Page Not Found
const pageNotFound = (req, res, next) => {
    try {
        res.status(404).render("404");
    } catch (error) {
        next(error); 
    }
};


// Load Login Page
const loadLogin = async (req, res, next) => {
    try {
        console.log("User loadLogin called, rendering signin.ejs");
        if (!req.session.user) {
            return res.render("signin"); // Renders views/signin.ejs
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
        if (emailSent) {
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
        req.session.destroy((err) => {
            if (err) {
                console.error("Session destruction error:", err.message);
                return next(err); 
            }
            return res.redirect("/login");
        });
    } catch (error) {
        console.error("Logout error:", error);
        next(error); 
    }
};





const forgotPassword = async (req, res) => {
    try {
  
      return res.render("forgotPassword")
      
    } catch (error) {
      console.log('Forgot password page renderign error',error);
      res.redirect("/pageNotFound");
    }
  }
  const forgotPasswordSendLink = async (req, res) => {
    try {
      const { email } = req.body;
  
      console.log("Received email:", email);
      if (!email) {
        return res.status(400).json({ success: false, message: "Email is required" });
      }
  
      const user = await User.findOne({ email, isAdmin: false });
  
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
  
      console.log("User found:", user);
  
      // Generate OTP
      const otp = generateOtp();
      user.forgotPasswordOtp = otp;
      user.otpExpires = Date.now() + 10 * 60 * 1000; 
      await user.save();
  
      console.log(otp)
     
      req.session.user=email
      // Send success response
       res.json({ success: true, message: "OTP sent to email" });
       
  
    } catch (error) {
      console.error("Error in forgot password:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
  
  const newPassword = async (req, res) => {
    try {
  
    
      return res.render("newPassword")
      
    } catch (error) {
      console.log('Forgot password page renderign error',error);
      res.redirect("/pageNotFound");
    }
  }
  
  const changePassword=async(req,res)=>{
    try {
      const passwordHash = await bcrypt.hash(req.body.password,10);
     await User.updateOne({email:req.session.user},{password:passwordHash})
     req.session.user=null
     res.json({success:"Successfully changed the password"})
    } catch (error) {
      console.log(error)
    }
  }

 
  const loadShop = async (req, res, next) => {
    try {
        // Initialize userData as null
        let userData = null;

        // Check if user is logged in and get user data if they are
        if (req.session.user && req.session.user.id) {
            userData = await User.findById(req.session.user.id);
        }

        const { email, name } = req.user;

        // Check if user exists
        const existingUser = await User.findOne({ email });

        if (!existingUser) {
            req.session.flashMessage = "No account found with this Gmail address. Please sign up first.";
            return res.redirect("/signup?form=signin");
        }

        // Check if the user is blocked
        if (existingUser.isBlocked) {
            req.session.flashMessage = "Your account is blocked. Please contact support.";
            return res.redirect("/signup?form=signin");
        }

        // Login successful
        req.session.user = {
            id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email
        };

        // Fetch only listed categories and unblocked brands
        const [categories, brands] = await Promise.all([
            Category.find({ isListed: true }), 
            Brand.find({ isBlocked: false })
        ]);

        // Base filter conditions
        const filter = {
            isBlocked: false,
            status: "Available"
        };

        // Add category filter only if categories exist
        if (categories.length > 0) {
            filter.category = { $in: categories.map(cat => cat._id) };
        }

        // Add brand filter only if brands exist
        if (brands.length > 0) {
            filter.brand = { $in: brands.map(brand => brand._id) };
        }

        // Add search filter
        if (query.search) {
            filter.productName = { $regex: query.search, $options: 'i' };
        }

        // Add category and brand filters if specified
        if (query.category) filter.category = query.category;
        if (query.brand) filter.brand = query.brand;

        // Add price range filters
        if (query.minPrice || query.maxPrice) {
            filter.salesPrice = {};
            if (query.minPrice) filter.salesPrice.$gte = parseInt(query.minPrice);
            if (query.maxPrice) filter.salesPrice.$lte = parseInt(query.maxPrice);
        }

        // Sort options
        let sortOptions = {};
        switch (query.sort) {
            case 'price-asc': sortOptions = { salesPrice: 1 }; break;
            case 'price-desc': sortOptions = { salesPrice: -1 }; break;
            case 'name-asc': sortOptions = { productName: 1 }; break;
            case 'name-desc': sortOptions = { productName: -1 }; break;
            default: sortOptions = { createdAt: -1 };
        }

        // Fetch products with valid categories and brands
        const products = await Product.find(filter)
            .sort(sortOptions)
            .populate('category')
            .populate('brand');

        console.log('Filtered Products:', products); 

        // Render the shop page
        res.render('shop', {
            products,
            categories,
            brands,
            query,
            userData, // if user didnt loged in this will be null
            isLoggedIn: !!req.session.user
        });

    } catch (error) {
        next(error); 
    }
};


const handleGoogleAuth = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Check if user exists
        const existingUser = await User.findOne({ _id: userId });

        if (!existingUser) {
            req.session.flashMessage = "No account found with this Gmail address. Please sign up first.";
            return res.redirect("/signup?form=signin");
        }

        // // Check if the user is blocked
        if (existingUser.isBlocked) {
            req.session.flashMessage = "Your account is blocked due to some issue. Please contact support at bagzosupport@gmail.com.";
            return res.redirect("/signup?form=signin");
        }


        req.session.user = {
            id: existingUser._id,
            name: existingUser.name
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
