    const User = require("../../models/userSchema");
    const env = require("dotenv").config();
    const nodemailer = require("nodemailer");
    const bcrypt = require("bcrypt");

    const loadHomePage = async (req, res) => {
        try {
            return res.render('home');
        } catch (error) {
            console.log("Home Page not found");
            res.status(500).send("Server error");
        }
    };

    const loadSignup = async (req, res) => {
        try {
            return res.render('signup');
        } catch (error) {
            console.log('Signup page not loading : ', error);
            res.status(500).send('Server Error');
        }
    };


    function generateOtp() {
        return Math.floor(100000 + Math.random() * 900000);
    }

    async function sendVerificationEmail(email, otp) {
        try {
            const transporter = nodemailer.createTransport({
                service: "gmail",
                port: 587,
                secure: false,
                requireTLS: true,
                auth: {
                    user: process.env.NODEMAILER_EMAIL,
                    pass: process.env.NODEMAILER_PASSWORD
                }
            });

            const info = await transporter.sendMail({
                from: process.env.NODEMAILER_EMAIL,
                to: email,
                subject: "Verify your account",
                text: `Your OTP is ${otp}`
            });

            return info.accepted.length > 0;
        } catch (error) {
            console.error("Error in sending email: ", error);
            return false;
        }
    }

    const signup = async (req, res) => { 
        try {
            const { name, phone, email, password, cPassword } = req.body;
            console.log(req.body);

            if (password !== cPassword) {
                return res.render('signup', { error: "Password does not match" });
            }

            const findUser = await User.findOne({ email: email });
if (findUser) {
    return res.render("signup", { emailError: "User with this email already exists" });
}



            
            const otp = generateOtp();
            
            const emailSend = await sendVerificationEmail(email, otp);

            if (!emailSend) {
                return res.json({ error: "email-error" });
            }

            req.session.userOtp = otp;
            req.session.userData = { name, phone, email, password };

            console.log("OTP sent successfully", otp);
            res.render("verifyOtp");        
        } catch (error) {
            console.error("Error in signup:", error);
            res.redirect("/pageNotFound");
        }
    };



    const loadShopping = async (req, res) => {
        try {
            return res.render('shop');
        } catch (error) {
            console.log("Shopping page not loading: ", error);
            res.status(500).send('Server Error');
        }
    };

    const pageNotFound = async (req, res) => {
        try {
            res.render("404");
        } catch (error) {
            res.redirect("/pageNotFound");
        }
    };

    const securePassword = async (password)=>{
        try{
        const passwordHash = await bcrypt.hash(password,10);
        return passwordHash;
    } catch (error){
        console.log('Password not hashed',error);
        return false;
    }
    }


    const verifyOtp = async (req, res) => {
        try {
            const { otp } = req.body;
            
            console.log("OTP from user", otp);
            // console.log("OTP from session", req.session.userOtp);
            // const userOtp = Number(req.session.userOtp);
            // console.log("OTP from session", userOtp);
            // Convert otp from the request to a number
            if (!req.session.userOtp || req.session.userOtp !== Number(otp)) {
                return res.json({ success: false, message: "Invalid or expired OTP" });
            }

            // OTP is valid, save user in the database (and hash password, etc.)
            const { name, phone, email, password } = req.session.userData;
            const hashedPassword = await securePassword(password);
            const newUser = new User({ name, phone, email, password: hashedPassword });
            await newUser.save();
            
            // Clear session after successful signup
            req.session.userOtp = null;
            req.session.userData = null;

            return res.json({ success: true, redirectUrl: "/dashboard" });
        } catch (error) {
            console.error("Error in OTP verification:", error);
            return res.json({ success: false, message: "Server error, please try again" });
        }
    };

    
    const resendOtp = async (req, res) => {
        try {
      
          if (!req.session.userData || !req.session.userData.email) {
            return res
              .status(400)
              .json({ success: false, message: "email not found in session" });
          }
      
          const otp = generateOtp();
          req.session.userOtp = otp;
      
          const emailSent = await sendVerificationEmail(
            req.session.userData.email,
            otp,
          );
      
          if (emailSent) {
            console.log("Resend OTP", otp);
            return res
              .status(200)
              .json({ success: true, message: "otp resend successfully" });
          }
      
          return res.status(500).json({
            success: false,
            message: "failed to resend otp. Please try again",
          });
        } catch (error) {
          console.error("Error resending OTP", error);
          res.status(500).json({
            success: false,
            message: "Internal server error.Please try again ",
          });
        }
      };
    
    
    module.exports = {
        loadHomePage,
        pageNotFound,
        loadSignup,
        loadShopping,
        signup,
        verifyOtp,
        resendOtp
    };
