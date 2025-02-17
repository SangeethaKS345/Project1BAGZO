const express = require('express');
const router = express.Router();
const userController= require("../controllers/user/userController")

router.get("/pageNotFound",userController.pageNotFound);
router.get("/", userController.loadHomePage);
router.get("/shop",userController.loadShopping);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post('/verify-otp', userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);

module.exports = router;
