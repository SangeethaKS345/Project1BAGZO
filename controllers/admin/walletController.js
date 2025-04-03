const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");

const getTransactionDetails = async (req, res, next) => {
  try {
    const transactionId = req.params.id;
    console.log('Fetching transaction details for ID:', transactionId);

    // Find wallet containing the transaction
    const wallet = await Wallet.findOne({ 'transactions._id': transactionId })
      .populate('user', 'name email phone')
      .lean();

    if (!wallet || !wallet.transactions) {
      console.log('Wallet or transactions not found for ID:', transactionId);
      return res.status(404).render('error', { 
        message: 'Transaction not found',
        status: 404 
      });
    }

    // Find the specific transaction
    const transaction = wallet.transactions.find(t => t._id.toString() === transactionId);
    if (!transaction) {
      console.log('Specific transaction not found for ID:', transactionId);
      return res.status(404).render('error', { 
        message: 'Transaction not found',
        status: 404 
      });
    }

    // Add user data to transaction
    transaction.user = wallet.user;

    // Extract orderId from description if present
    const orderIdMatch = transaction.description.match(/order #(\w+)/);
    if (orderIdMatch) {
      transaction.orderId = orderIdMatch[1];
    }

    res.render('transactionDetails', { transaction });
  } catch (error) {
    console.error('Error retrieving transaction details:', error);
    next(error);
  }
};

// Update loadWalletPage to flatten transactions
const loadWalletPage = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const wallets = await Wallet.find()
      .populate('user', 'name email phone')
      .lean();

    // Flatten transactions from all wallets
    const allTransactions = wallets.reduce((acc, wallet) => {
      return acc.concat(wallet.transactions.map(t => ({
        ...t,
        user: wallet.user,
        transactionId: t._id
      })));
    }, []);

    // Sort and paginate
    const sortedTransactions = allTransactions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(skip, skip + limit);

    const totalTransactions = allTransactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);

    res.render('wallets', {
      transactions: sortedTransactions,
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
  getTransactionDetails, // Exporting getTransactionDetails method
};