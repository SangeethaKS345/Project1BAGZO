const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');


const loadWalletPage = async (req, res, next) => {
    try {
        // Get user's wallet or create if doesn't exist
        let wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet) {
            wallet = new Wallet({ user: req.user._id });
            await wallet.save();
        }

        // Get transactions sorted by date
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
    addWalletTransaction 
  };

