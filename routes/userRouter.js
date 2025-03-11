

const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("passport");
const { userAuth, adminAuth, checkBlockStatus } = require("../middlewares/auth");
const productController = require("../controllers/user/productController");
const cartController = require("../controllers/user/cartController");
const shopController = require("../controllers/user/shopController");
const profileController = require("../controllers/user/profileController");
const addressController = require("../controllers/user/addressController");
const orderController = require('../controllers/user/orderController');
const { errorHandler } = require("../middlewares/errorHandler");
//error handling middleware
router.use(errorHandler);

// User Authentication Routes
router.get("/", userController.loadHomepage);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get("/signin",userController.loadLogin)
router.post("/signin", userController.login)

// Google OAuth Routes
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

// Shop Route
router.get("/shop", shopController.loadShop);

// Cart Routes
router.get("/cart", userAuth, cartController.getCartPage);
router.post("/add-to-cart", userAuth, cartController.addToCart);
router.post("/cart/changeQuantity", userAuth, cartController.changeQuantity);
router.delete("/cart/delete", userAuth, cartController.deleteProduct);

//profile forgetPassword
router.get("/forgot-password", profileController.getForgotPassword);
router.post("forget-password", profileController.forgotEmailValid);
router.post("verify-otp", profileController.verifyForgotPassOtp)
router.get("/reset-password", profileController.getResetPassword);
router.post("/reset-password", profileController.postNewPassword);
router.post("/resend-otp", profileController.resendOtp);

// User Profile Routes
// Protected routes
router.get("/profile", userAuth, profileController.userProfile);
//router.get("/account", userAuth, profileController.getAccount);
router.get("/editProfile", userAuth, profileController.getEditProfile);
router.patch("/editProfile/update", userAuth, profileController.updateEditProfile);

// Address routes (using userAuth middleware)
router.get("/address", userAuth, addressController.getAddresses);
router.get("/address/new", userAuth, addressController.addAddressForm);
router.post("/address", userAuth, addressController.addAddress);
router.get("/address/edit/:id", userAuth, addressController.editAddressForm);
router.post("/address/edit/:id", userAuth, addressController.updateAddress);
router.get("/address/delete/:id", userAuth, addressController.deleteAddress);

//Order route
router.get('/cart',orderController.getCartPage);
router.get('/checkout',orderController.getCheckoutPage);

// Debugging Route
router.get("/session-check", (req, res) => {
    res.json(req.session);
});

module.exports = router;
