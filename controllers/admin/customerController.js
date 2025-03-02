const User = require("../../models/userSchema");

// Fetch customer info
const customerInfo = async (req, res, next) => {
    try {
        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1;
<<<<<<< HEAD
        const limit = 3;
=======
        const limit = 5;
>>>>>>> 334f225 (cart page added. working on profile page.)

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        })
        .limit(limit)
        .skip((page - 1) * limit)
        .sort({ createdOn: -1 })
        .exec();

        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        });

        res.render("customers", { data: userData, totalPages: Math.ceil(count / limit), currentPage: page });

    } catch (error) {
        next(error); // Passes error to middleware
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