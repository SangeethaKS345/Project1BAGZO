const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");

// Load Wallet Page
const getTransactionDetails = async (req, res, next) => {
  try {
    const transactionId = req.params.id;
    console.log('Fetching transaction details for ID:', transactionId);

    // Fetch wallet and transaction data
    const [wallet] = await Promise.all([
      Wallet.findOne({ 'transactions._id': transactionId })
        .populate('user', 'name email phone')
        .lean()
    ]);

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


const loadWalletPage = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const type = req.query.type || 'all';

    const query = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { 'transactions.transactionId': searchRegex },
        { 'transactions.description': searchRegex },
        { 'user.name': searchRegex },
        { 'user.email': searchRegex },
      ];
    }
    if (type !== 'all') {
      query['transactions.type'] = type;
    }

    const wallets = await Wallet.find(query)
      .populate('user', 'name email phone')
      .lean();

    let allTransactions = wallets.reduce((acc, wallet) => {
      return acc.concat(wallet.transactions.map(t => ({
        ...t,
        user: wallet.user,
        transactionId: t._id,
      })));
    }, []);

    if (search || type !== 'all') {
      allTransactions = allTransactions.filter(t => {
        const matchesSearch = search ? (
          t.transactionId.toString().toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase()) ||
          (t.user && t.user.name.toLowerCase().includes(search.toLowerCase())) ||
          (t.user && t.user.email.toLowerCase().includes(search.toLowerCase()))
        ) : true;
        const matchesType = type !== 'all' ? t.type === type : true;
        return matchesSearch && matchesType;
      });
    }

    const sortedTransactions = allTransactions
      .sort((a, b) => new Date(b.date) - new Date(a.date)) // Newest first
      .slice(skip, skip + limit);

    const totalTransactions = allTransactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);

    res.render('wallets', {
      transactions: sortedTransactions,
      currentPage: page,
      totalPages,
      search,
      type,
    });
  } catch (error) {
    console.error('Error loading wallet page:', error);
    next(error);
  }
};

module.exports = {
  loadWalletPage,
  getTransactionDetails
};