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
router.get("/forgotPassword", userController.forgotPasssword)
router.post("/resetPassword", userController.forgotPassswordSendLink);
router.get("/newPassword", userController.newPassword)
router.post("/newPassword",userController.changePassword)
// userRouter.js
router.get("/productDetails",productController.productDetails);  // Make sure this matches your controller export


//shop route
router.get('/shop', userController.loadShop);


module.exports = router;

