const Razorpay = require('razorpay');
const env = require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_ASBWnzcWKwD24T',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'HYGjsptHY8XsPAhP1o9XDFsp'
  });

  module.exports = razorpay;