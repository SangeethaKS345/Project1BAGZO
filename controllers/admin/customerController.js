const User = require("../../models/userSchema");

// Fetch customer info
const customerInfo = async (req, res, next) => {
    try {
        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1;
        const limit = 3;

        let searchConditions = [];
        const searchRegex = new RegExp(search, "i");

        // Text-based searches
        searchConditions.push({ name: { $regex: searchRegex } });
        searchConditions.push({ email: { $regex: searchRegex } });
        searchConditions.push({ phone: { $regex: searchRegex } });
        // Status search
        if (search.toLowerCase().includes('block')) {
            searchConditions.push({ isBlocked: true });
        } else if (search.toLowerCase().includes('active')) {
            searchConditions.push({ isBlocked: false });
        }

        const userData = await User.find({
            isAdmin: false,
            $or: searchConditions
        })
        .limit(limit)
        .skip((page - 1) * limit)
        .sort({ createdOn: -1 })
        .exec();

        const count = await User.countDocuments({
            isAdmin: false,
            $or: searchConditions
        });

        res.render("customers", { 
            data: userData, 
            totalPages: Math.ceil(count / limit), 
            currentPage: page,
            search: search // Pass search term back to template
        });
    } catch (error) {
        next(error);
    }
};

// Block a customer
const customerBlocked = async (req, res, next) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.json({ success: true, message: 'User blocked successfully' });
    } catch (error) {
        next(error);
    }
};

// Unblock a customer
const customerunBlocked = async (req, res, next) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.json({ success: true, message: 'User unblocked successfully' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    customerInfo,
    customerBlocked,
    customerunBlocked
};