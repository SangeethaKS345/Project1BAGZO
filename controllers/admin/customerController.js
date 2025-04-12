const User = require("../../models/userSchema");

// Render Customers Page with Pagination and Search
const renderCustomersPage = async (req, res, next) => {
    try {
        const perPage = parseInt(req.query.limit, 10) || 10; // Default to 10 items per page
        const page = parseInt(req.query.page, 10) || 1; // Default to page 1
        const search = req.query.search || ""; // Search term
        const status = req.query.status || "all"; // Status filter

        const query = { isAdmin: false }; // Base query for non-admin users

        // Add search conditions
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ];
        }

        // Filter by status
        if (status === "block") {
            query.isBlocked = true;
        } else if (status === "unblock") {
            query.isBlocked = false;
        }

        // Fetch users and total count
        const [users, totalUsers] = await Promise.all([
            User.find(query)
                .sort({ createdOn: -1 }) // Sort by creation date
                .skip((page - 1) * perPage)
                .limit(perPage),
            User.countDocuments(query),
        ]);

        const totalPages = Math.ceil(totalUsers / perPage);

        // Render the customers page
        res.render("customers", {
            data: users,
            currentPage: page,
            totalPages,
            perPage,
            search,
            status,
            queryParams: `search=${search}&status=${status}`, // For constructing pagination links
        });
    } catch (error) {
        console.error("Error rendering customers page:", error);
        next(error); // Pass error to global error handler
    }
};

// Block a Customer
const blockCustomer = async (req, res, next) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ success: false, message: "User ID is required." });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        user.isBlocked = true;
        await user.save();

        res.status(200).json({
            success: true,
            message: "User has been successfully blocked.",
        });
    } catch (error) {
        console.error("Error blocking customer:", error);
        next(error);
    }
};

// Unblock a Customer
const unblockCustomer = async (req, res, next) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ success: false, message: "User ID is required." });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        user.isBlocked = false;
        await user.save();

        res.status(200).json({
            success: true,
            message: "User has been successfully unblocked.",
        });
    } catch (error) {
        console.error("Error unblocking customer:", error);
        next(error);
    }
};

module.exports = {
    renderCustomersPage,
    blockCustomer,
    unblockCustomer,
};