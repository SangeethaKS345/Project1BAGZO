const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");

const loadWalletPage = async (req, res, next) => {
  try {
    console.log('Attempting to render view from paths:', res.locals.viewsPaths);  
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const wallets = await Wallet.find()
      .populate('user', 'name email phone')
      .sort({ 'transactions.date': -1 }) // Sort transactions by date, newest first
      .skip(skip)
      .limit(limit)
      .lean();

    const totalTransactions = await Wallet.countDocuments();
    const totalPages = Math.ceil(totalTransactions / limit);

    res.render('wallets', {
      transactions: wallets,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error('Error loading wallet page:', error);
    next(error);
  }
};

module.exports = {
  loadWalletPage,
};

