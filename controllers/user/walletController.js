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



module.exports = {
    loadWalletPage
} 