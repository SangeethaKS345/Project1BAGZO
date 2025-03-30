const User = require("../../models/userSchema");

// Fetch customer info
const customerInfo = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 3;
        const skip = (page - 1) * limit;

        const searchRegex = new RegExp(search, "i");
        const searchConditions = [
            { name: { $regex: searchRegex } },
            { email: { $regex: searchRegex } },
            { phone: { $regex: searchRegex } },
            ...(search.toLowerCase().includes('block') ? [{ isBlocked: true }] : search.toLowerCase().includes('active') ? [{ isBlocked: false }] : [])
        ];

        const [userData, count] = await Promise.all([
            User.find({
                isAdmin: false,
                $or: searchConditions
            })
            .limit(limit)
            .skip(skip)
            .sort({ createdOn: -1 })
            .exec(),
            User.countDocuments({
                isAdmin: false,
                $or: searchConditions
            })
        ]);

        res.render("customers", { 
            data: userData, 
            totalPages: Math.ceil(count / limit), 
            currentPage: page,
            search // Pass search term back to template
        });
    } catch (error) {
        next(error);
    }
};

// Block a customer
const customerBlocked = async (req, res, next) => {
    try {
        const { id } = req.query;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.json({ success: true, message: 'User blocked successfully' });
    } catch (error) {
        next(error);
    }
};

// Unblock a customer
const customerunBlocked = async (req, res, next) => {
    try {
        const { id } = req.query;
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