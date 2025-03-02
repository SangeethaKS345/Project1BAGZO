<<<<<<< HEAD
// const express = require('express');
// const router = express.Router();
// const userController= require("../controllers/user/userController");
// const passport = require('passport');
// const sendOTP  = require('../controllers/user/userController');
// const productController = require('../controllers/user/productController')


// router.get("/pageNotFound",userController.pageNotFound);

// router.get("/pageNotFound",userController.pageNotFound);
// router.get("/", userController.loadHomepage);
// // router.get("/shop",userController.loadShopping);
// router.get("/signup", userController.loadSignup);
// router.post("/signup", userController.signup,);
// router.post('/verify-otp', userController.verifyOtp);
// router.post("/resend-otp", userController.resendOtp);

// router.get("/auth/google", passport.authenticate('google', {scope : ['profile', 'email']}));

// router.get("/auth/google/callback", passport.authenticate('google', {failureRedirect : "/signup"}), (req, res) => {
//     res.redirect("/");
// });

// //router.get("/login", userController.loadLogin);
// router.get("/login", (req, res) => {
//     res.redirect("/signup?action=signup"); 
// });

// router.post("/signin", userController.login);



// router.get("/logout", userController.logout);


// //reset password
// router.get("/forgotPassword", userController.forgotPasssword)
// router.post("/resetPassword", userController.forgotPassswordSendLink);
// router.get("/newPassword", userController.newPassword)
// router.post("/newPassword",userController.changePassword)
// // userRouter.js
// router.get("/productDetails",productController.productDetails);  // Make sure this matches your controller export


// //shop route
// router.get('/shop', userController.loadShop);

// router.get("/session-check", (req, res) => {
//     res.json(req.session);
//   });


// module.exports = router;

=======


>>>>>>> 334f225 (cart page added. working on profile page.)
const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("passport");
const productController = require("../controllers/user/productController");
<<<<<<< HEAD
const {errorHandler} = require("../middlewares/errorHandler");
=======
const profileController = require("../controllers/user/profileController");
const shopController = require("../controllers/user/shopController")
const cartController = require("../controllers/user/cartController");
const {errorHandler} = require("../middlewares/errorHandler");
const { userAuth } = require("../middlewares/auth");
>>>>>>> 334f225 (cart page added. working on profile page.)
//error handling middleware
router.use(errorHandler);

// User Authentication Routes
router.get("/", userController.loadHomepage);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get("/signin",userController.login)
router.post("/signin", userController.login)

// Google OAuth Routes
<<<<<<< HEAD
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/signup" }),
    userController.handleGoogleAuth
    // (req, res) => {
    //     req.session.user = {
    //         id: req.user._id,
    //         name: req.user.name,}

    //     res.redirect("/"); 
    // }
=======
// router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// router.get(
//     "/auth/google/callback",
//     passport.authenticate("google", { failureRedirect: "/signup" }),
//     userController.handleGoogleAuth
//     // (req, res) => {
//     //     req.session.user = {
//     //         id: req.user._id,
//     //         name: req.user.name,}

//     //     res.redirect("/"); 
//     // }
// );

router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/signup" }),
    userController.handleGoogleAuth
>>>>>>> 334f225 (cart page added. working on profile page.)
);

// Login & Logout Routes
router.get("/login", (req, res) => {
    res.redirect("/signin"); 
});
router.post("/signin", userController.login);
router.get("/logout", userController.logout);

// Reset Password Routes
router.get("/forgotPassword", userController.forgotPassword);
router.post("/resetPassword", userController.forgotPasswordSendLink); // Fixed typo in function name
router.get("/newPassword", userController.newPassword);
router.post("/newPassword", userController.changePassword);

// Product Routes
router.get("/productDetails", productController.productDetails);
<<<<<<< HEAD
=======

// Shop Route
router.get("/shop", shopController.loadShop);

// Debugging Route
router.get("/session-check", (req, res) => {
    res.json(req.session);
});

//cart route
router.get('/cart', userAuth, cartController.getCartPage);
router.post('/add-to-cart', userAuth, cartController.addToCart);
router.post('/changeQuantity', userAuth, cartController.changeQuantity);  // Changed URL and method
router.get('/deleteItem', userAuth, cartController.deleteProduct);  // Changed URL and method
>>>>>>> 334f225 (cart page added. working on profile page.)

// Shop Route
router.get("/shop", userController.loadShop);

<<<<<<< HEAD
// Debugging Route
router.get("/session-check", (req, res) => {
    res.json(req.session);
});

module.exports = router;
=======


//profile route
//router.get("/profile",profileController.loadUserProfile);

module.exports = router;
>>>>>>> 334f225 (cart page added. working on profile page.)
