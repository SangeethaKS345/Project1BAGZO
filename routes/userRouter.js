const express = require('express');
const router = express.Router();
const userController= require("../controllers/user/userController");
const passport = require('passport');
const sendOTP  = require('../controllers/user/userController');
const productController = require('../controllers/user/productController')


router.get("/pageNotFound",userController.pageNotFound);

router.get("/pageNotFound",userController.pageNotFound);
router.get("/", userController.loadHomepage);
// router.get("/shop",userController.loadShopping);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup,);
router.post('/verify-otp', userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);

router.get("/auth/google", passport.authenticate('google', {scope : ['profile', 'email']}));

router.get("/auth/google/callback", passport.authenticate('google', {failureRedirect : "/signup"}), (req, res) => {
    res.redirect("/");
});

//router.get("/login", userController.loadLogin);
router.get("/login", (req, res) => {
    res.redirect("/signup?action=signup"); 
});

router.post("/signin", userController.login);



router.get("/logout", userController.logout);


//reset password
router.get("/forgot-password", userController.forgotPasssword)
router.post("/reset-password", userController.forgotPassswordSendLink);
router.get("/new-password", userController.newPassword)
router.post("/new-password",userController.changePassword)
// userRouter.js
router.get("/product-details",productController.productDetails);  // Make sure this matches your controller export


//shop route
router.get('/shop', userController.loadShop);


module.exports = router;

