const User = require("../../models/userSchema");
const dotenv = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema"); 
const Brand = require("../../models/brandSchema");

// Load Home Page
const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user;
        // Fix: Use `Category.find`, not `category.find`
        const categories = await Category.find({ isListed: true });

        // Fix: Use `Product.find`, not `product.find`
        let productData = await Product.find({
            isBlocked: false,

        });

        console.log(productData)
        // Fix: Corrected sorting field (assuming `createdAt` is the correct field)
        productData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (user) {
            const userData = await User.findOne({ _id: user });
            return res.render("home", { userData, products: productData });
        } else {
            return res.render("home", { products: productData, userData: "" });
        }

    } catch (error) {
        console.error("Error loading homepage:", error);
        res.status(500).send("Server Error");
    }
};


// Load Signup Page
const loadSignup = async (req, res) => {
    try {
        return res.render('signup', { message: "" }); // Ensuring 'message' is always passed
    } catch (error) {
        console.error("Signup page not loading:", error);
        res.status(500).send("Server Error");
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

        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
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
const signup = async (req, res) => {
    try {
        // let message=null;
        const { name, phone, email, password, cPassword } = req.body;

        if (!name || !phone || !email || !password || !cPassword) {
            const message = "All fields are required";
            return res.render("signup", { message });
        }

        if (password !== cPassword) {
            const message = "Passwords do not match";
            return res.render("signup", { message });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            const message = "User already exists";
            console.log("Rendering signup page with message:", message);
            return res.render("signup", { message });
        }

        // Generate OTP and store it in session
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.render("signup", { message: "Failed to send OTP. Try again" });
        }

        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password };

        console.log("OTP sent successfully:", otp);
        res.render("verifyOtp");
    } catch (error) {
        console.error("Error in signup:", error);
        res.redirect("/pageNotFound");
    }
};




// Verify OTP
const verifyOtp = async (req, res) => {
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

        return res.json({ success: true, redirectUrl: "/" });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        return res.json({ success: false, message: "Server error, try again" });
    }
};

// Resend OTP
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

// Load Shopping Page
// const loadShopping = async (req, res) => {
//     try {
//         return res.render('shop');
//     } catch (error) {
//         console.error("Shopping page not loading:", error);
//         res.status(500).send("Server Error");
//     }
// };

// Page Not Found
const pageNotFound = async (req, res) => {
    try {
        res.render("404");
    } catch (error) {
        res.redirect("/404");
    }
};

// Load Login Page
const loadLogin = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.render("login");
        } else {
            res.redirect("/");
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

// Login Handler
const login = async (req, res) => {
    try {
        console.log("Signin route hit"); // Debugging log
        const { email, password } = req.body;
        if (!email || !password) {
            // return res.status(400).json({ message: "Email and password are required" });
            return res.render("signup", { message: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            // return res.status(404).json({ message: "User not found" });
            return res.render("signup", { message: "User not found" });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            // return res.status(401).json({ message: "Incorrect password" });
            return res.render("signup", { message: "Incorrect password" });
        }

        req.session.user = user._id;
        res.redirect("/");
    } catch (error) {
        console.error("Login Error:", error);
        // res.status(500).json({ message: "Internal server error" });
        return res.redirect("/pageNotFound");
    }
};


const logout = async(req,res) =>{
    try {
        req.session.destroy((err) => {
            if(err){
                console.error("Session destruction error", err.message);
                return res.redirect("/pageNotFound");
            }
           return res.redirect("/login");
        })
    } catch (error) {
        
        console.log("Logout error:", error);
        res.redirect("/pageNotFound");
    }
}

const forgotPasssword = async (req, res) => {
    try {
  
      return res.render("forgotPassword")
      
    } catch (error) {
      console.log('Forgot password page renderign error',error);
      res.redirect("/pageNotFound");
    }
  }
  const forgotPassswordSendLink = async (req, res) => {
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


 
const loadShop = async (req, res) => {
    try {
        // Initialize userData as null
        let userData ;
        
        // Check if user is logged in and get user data if they are
        if (req.session.user) {
            userData = await User.findOne({ _id: req.session.user });
        }

        const query = {
            search: req.query.search || '',
            sort: req.query.sort || '',
            category: req.query.category || '',
            brand: req.query.brand || '',
            maxPrice: req.query.maxPrice || '',
            minPrice: req.query.minPrice || ''
        };

        // Base filter conditions
        const filter = {
            isBlocked: false,
            status: "Available"
        };

        // Add search filter if provided
        if (query.search) {
            filter.productName = { $regex: query.search, $options: 'i' };
        }

        // Add category filter if provided
        if (query.category) {
            filter.category = query.category;
        }

        // Add brand filter if provided
        if (query.brand) {
            filter.brand = query.brand;
        }

        // Add price range filter if provided
        if (query.minPrice || query.maxPrice) {
            filter.salesPrice = {};
            if (query.minPrice) filter.salesPrice.$gte = parseInt(query.minPrice);
            if (query.maxPrice) filter.salesPrice.$lte = parseInt(query.maxPrice);
        }

        // Sort options
        let sortOptions = {};
        switch (query.sort) {
            case 'price-asc':
                sortOptions = { salesPrice: 1 };
                break;
            case 'price-desc':
                sortOptions = { salesPrice: -1 };
                break;
            case 'name-asc':
                sortOptions = { productName: 1 };
                break;
            case 'name-desc':
                sortOptions = { productName: -1 };
                break;
            default:
                sortOptions = { createdAt: -1 };
        }

        // Fetch all required data
        const [products, categories, brands] = await Promise.all([
            Product.find(filter)
                   .sort(sortOptions)
                   .populate('category')
                   .populate('brand'),
            Category.find({ isListed: true }),
            Brand.find()
        ]);

        console.log('Products:', products); // Debug log

        // Render the shop page with or without user data
        res.render('shop', {
            products,
            categories,
            brands,
            query,
            userData, // This will be null for non-logged-in users
            isLoggedIn: !!req.session.user // Add a boolean flag for login status
        });

    } catch (error) {
        console.error('Shop page error:', error);
        res.status(500).send('Internal Server Error');
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
    // loadShopping,
    pageNotFound,
    loadLogin,
    login,
    logout,
    forgotPasssword,
    forgotPassswordSendLink,
    newPassword,
    changePassword,
    loadShop
};
