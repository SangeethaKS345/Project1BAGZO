const path = require('path');
const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const razorpay = require('../../config/razorpay');
const crypto = require('crypto');



const loadWalletPage = async (req, res, next) => {
    try {
        let wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet) {
            wallet = new Wallet({ user: req.user._id });
            await wallet.save();
        }

        const transactions = wallet.transactions.sort((a, b) => b.date - a.date);

        res.render('wallet', {
            user: req.user,
            wallet,
            transactions
        });
    } catch (error) {
        next(error);
    }
};

const addMoneyToWallet = async (req, res, next) => {
    try {
        const { amount } = req.body;

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid amount greater than 0.'
            });
        }

        let wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet) {
            wallet = new Wallet({ user: req.user._id });
        }

        if (amount > 100000) {
            return res.status(400).json({
                success: false,
                error: 'You cannot add more than ₹1,00,000 at a time.'
            });
        }

        if (wallet.balance + Number(amount) > 200000) {
            return res.status(400).json({
                success: false,
                error: 'Your wallet cannot hold more than ₹2,00,000.'
            });
        }

        const options = {
            amount: amount * 100, // Convert to paise
            currency: "INR",
            receipt: `wallet_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        res.json({
            success: true,
            order,
            keyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to process payment. Please try again.'
        });
        next(error);
    }
};

const verifyPayment = async (req, res, next) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing payment details.'
            });
        }

        const secretKey = process.env.RAZORPAY_KEY_SECRET;
        if (!process.env.RAZORPAY_KEY_SECRET) {
            console.error('RAZORPAY_KEY_SECRET is undefined in walletController.js. Check if app.js loaded it correctly.');
            throw new Error('RAZORPAY_KEY_SECRET is missing');
        }
        console.log('RAZORPAY_KEY_SECRET in walletController.js:', process.env.RAZORPAY_SECRET_KEY);

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const generated_signature = crypto
            .createHmac('sha256', secretKey)
            .update(sign)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: 'Payment verification failed due to invalid signature.'
            });
        }

        const order = await razorpay.orders.fetch(razorpay_order_id);
        const amount = order.amount / 100; // Convert from paise to rupees

        let wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet) {
            wallet = new Wallet({ user: req.user._id });
        }

        wallet.transactions.push({
            type: 'credit',
            amount: amount,
            description: `Wallet recharge - ${razorpay_payment_id}`
        });

        wallet.balance += Number(amount);
        await wallet.save();

        return res.json({
            success: true,
            message: 'Payment verified successfully',
            newBalance: wallet.balance
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred during payment verification.'
        });
    }
};

const addWalletTransaction = async (userId, amount, type, description) => {
    try {
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            wallet = new Wallet({ user: userId });
        }

        if (type === 'debit' && wallet.balance < amount) {
            throw new Error('Insufficient wallet balance');
        }

        wallet.balance = type === 'credit' ? wallet.balance + amount : wallet.balance - amount;
        wallet.transactions.push({
            type,
            amount,
            description,
            date: new Date()
        });

        await wallet.save();
        return wallet;
    } catch (error) {
        throw new Error(`Wallet transaction failed: ${error.message}`);
    }
};

module.exports = {
    loadWalletPage,
    addWalletTransaction,
    addMoneyToWallet,
    verifyPayment
};