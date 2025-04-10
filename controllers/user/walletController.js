const path = require('path');
const mongoose = require('mongoose');
const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const razorpay = require('../../config/razorpay');
const crypto = require('crypto');

// Helper function to create or get a wallet
const getOrCreateWallet = async (userId) => {
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
        wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
        await wallet.save();
        console.log("Created new wallet for user:", userId);
    }
    return wallet;
};

// Load Wallet Page
const loadWalletPage = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // Number of transactions per page
        const skip = (page - 1) * limit;

        let wallet = await getOrCreateWallet(req.user._id);

        console.log("Wallet data retrieved:", wallet);
        console.log("Total transactions in wallet:", wallet.transactions.length);

        // Get total number of transactions
        const totalTransactions = wallet.transactions.length;

        // Sort transactions and apply pagination
        const transactions = wallet.transactions
            .sort((a, b) => b.date - a.date) // Sort by date descending
            .slice(skip, skip + limit);

        console.log("Paginated transactions to display:", transactions);

        // Calculate total pages
        const totalPages = Math.ceil(totalTransactions / limit);

        res.render('wallet', {
            user: req.user,
            wallet,
            transactions,
            currentPage: page,
            totalPages,
            hasPrev: page > 1,
            hasNext: page < totalPages
        });
    } catch (error) {
        console.error("Error loading wallet page:", error);
        next(error);
    }
};

// Add Money to Wallet - Recharge Wallet with RazorPay
const addMoneyToWallet = async (req, res, next) => {
    try {
        const { amount } = req.body;

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid amount greater than 0.'
            });
        }

        let wallet = await getOrCreateWallet(req.user._id);

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

// Verify Payment
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

        let wallet = await getOrCreateWallet(req.user._id);

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

// Add Wallet Transaction
const addWalletTransaction = async (userId, amount, type, description) => {
    try {
        console.log(`[WALLET START] Transaction for user ${userId}: Type=${type}, Amount=${amount}, Description=${description}`);

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            console.log(`[WALLET ERROR] Invalid userId: ${userId}`);
            throw new Error('Invalid user ID');
        }

        if (!amount || amount <= 0) {
            console.log(`[WALLET ERROR] Invalid amount: ${amount}`);
            throw new Error('Transaction amount must be greater than 0');
        }

        let wallet = await getOrCreateWallet(userId);

        console.log(`[WALLET BEFORE] Balance: ₹${wallet.balance}, Transaction count: ${wallet.transactions.length}`);

        if (type === 'debit' && wallet.balance < amount) {
            console.log(`[WALLET ERROR] Insufficient balance: Current=₹${wallet.balance}, Required=₹${amount}`);
            throw new Error('Insufficient wallet balance');
        }

        const previousBalance = wallet.balance;
        wallet.balance = type === 'credit' ? wallet.balance + amount : wallet.balance - amount;
        wallet.transactions.push({
            type,
            amount,
            description,
            date: new Date()
        });

        const savedWallet = await wallet.save();
        console.log(`[WALLET SUCCESS] Transaction saved: Previous balance=₹${previousBalance}, New balance=₹${savedWallet.balance}`);
        console.log(`[WALLET] Latest transaction: ${JSON.stringify(savedWallet.transactions[savedWallet.transactions.length - 1])}`);

        return savedWallet;
    } catch (error) {
        console.error(`[WALLET FATAL] Transaction failed: ${error.stack}`);
        throw new Error(`Wallet transaction failed: ${error.message}`);
    }
};

module.exports = {
    loadWalletPage,
    addWalletTransaction,
    addMoneyToWallet,
    verifyPayment
};