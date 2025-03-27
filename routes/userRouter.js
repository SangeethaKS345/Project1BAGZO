

const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("passport");
const { userAuth, adminAuth, checkBlockStatus} = require("../middlewares/auth");
const productController = require("../controllers/user/productController");
const cartController = require("../controllers/user/cartController");
const shopController = require("../controllers/user/shopController");
const profileController = require("../controllers/user/profileController");
const addressController = require("../controllers/user/addressController");
const checkoutController = require('../controllers/user/checkoutControlller');
const walletController = require("../controllers/user/walletController");
const orderController = require("../controllers/user/orderController");
const wishlistController = require("../controllers/user/wishlistController");
const { errorHandler } = require("../middlewares/errorHandler");
//error handling middleware
router.use(errorHandler);


// User Authentication Routes
router.get("/", userController.loadHomepage);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get("/signin", userController.loadLogin);
router.post("/signin", userController.login);

// Google OAuth Routes
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/signup" }),
    userController.handleGoogleAuth
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

// Profile Forgot Password Routes
router.get("/forgot-password", profileController.getForgotPassword);
router.post("/forgot-password", profileController.forgotEmailValid);
router.post("/verify-otp", profileController.verifyForgotPassOtp);
router.get("/reset-password", profileController.getResetPassword);
router.post("/reset-password", profileController.postNewPassword);
router.post("/resend-otp", profileController.resendOtp);


// User Profile Routes (Protected)
router.get("/profile", userAuth, profileController.userProfile);
router.get("/editProfile", userAuth, profileController.getEditProfile);
router.patch("/editProfile/update", userAuth, profileController.updateEditProfile);

// Email Verification Routes for Profile Editing
router.post("/editProfile/send-otp", userAuth, profileController.sendEmailOtp);
router.post("/editProfile/verify-otp", userAuth, profileController.verifyEmailOtp);

// Address Routes
router.get('/address', userAuth, addressController.getAddresses);
router.get('/address/new', userAuth, addressController.addAddressForm);
router.post('/address', userAuth, addressController.addAddress);
router.get('/address/edit/:id', userAuth, addressController.editAddressForm);
router.post('/address/edit/:id', userAuth, addressController.updateAddress); 
router.delete('/address/:id', userAuth, addressController.deleteAddress);

// Cart Management
router.get('/cart', userAuth, checkoutController.getCartPage);
router.get('/user/cart-data', userAuth, checkoutController.getCartDataForUser);

// Checkout Management
router.get('/checkout', userAuth, checkoutController.getCheckoutPage);
router.post('/place-order', userAuth, checkoutController.placeOrder);
router.post('/verify-payment', userAuth, checkoutController.verifyPayment);
router.post('/apply-coupon', userAuth, checkoutController.applyCoupon);
router.post('/payment-failed', userAuth, checkoutController.paymentFailed);

// Order Management
router.get('/orderPlaced', userAuth, orderController.getOrderPlaced);
router.get('/my-orders', userAuth, orderController.loadMyOrders);
router.post('/cancel-order/:orderId', userAuth, orderController.cancelOrder);
router.post('/return-order/:orderId', userAuth, orderController.returnOrder);
router.get('/download-invoice/:orderId', userAuth, orderController.downloadInvoice);
router.get('/orderFailure', userAuth, checkoutController.getOrderFailurePage);
router.get('/order-details/:orderId', userAuth, orderController.getOrderDetails);


// Wallet Management
router.get('/user/wallet', userAuth, walletController.loadWalletPage);
router.post('/add-wallet-money', userAuth, walletController.addMoneyToWallet);
router.post('/verify-wallet-payment', userAuth, walletController.verifyPayment);

// Wishlist Management
router.get('/wishlist', userAuth, wishlistController.loadWishlistPage);
router.post('/wishlist/add/:productId([0-9a-fA-F]{24})', userAuth, wishlistController.addToWishlist);
router.delete('/wishlist/remove/:productId', userAuth, wishlistController.removeFromWishlist);
router.get('/wishlist/check-status', userAuth, wishlistController.checkWishlistStatus);
router.post('/wishlist/toggle/:productId([0-9a-fA-F]{24})', userAuth, wishlistController.toggleWishlist);

module.exports = router;