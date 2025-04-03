const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");

const loadWalletPage = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const wallets = await Wallet.find()
      .populate('user', 'name email phone')
      .lean();

    let allTransactions = [];
    wallets.forEach(wallet => {
      wallet.transactions.forEach(transaction => {
        allTransactions.push({
          ...transaction,
          user: wallet.user,
          _id: wallet._id,
          description: transaction.description || 
            (transaction.type === 'credit' ? 'Wallet Recharge' : 'Order Payment')
        });
      });
    });

    // Sort and paginate
    allTransactions = allTransactions
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const totalTransactions = allTransactions.length;
    const paginatedTransactions = allTransactions.slice(skip, skip + limit);
    const totalPages = Math.ceil(totalTransactions / limit);

    res.render('wallets', {
      transactions: paginatedTransactions,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (error) {
    console.error('Error loading wallet page:', error);
    next(error);
  }
};

module.exports = {
  loadWalletPage,
};