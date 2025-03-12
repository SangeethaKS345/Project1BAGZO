const Order = require('../../models/orderSchema');

const getOrderPlaced = async (req, res, next) => {
    try {
        console.log("Accessed /orderPlaced route");
        if (!req.user) throw new Error("User not authenticated");

        const order = await Order.findOne({ userId: req.user._id })
            .sort({ createdOn: -1 })
            .populate('OrderItems.product')
            .populate('address');

        if (!order) {
            return res.render("orderPlaced", { message: "No recent order found." });
        }

        const orderDetails = {
            orderId: order.orderId,
            totalAmount: order.finalAmount,
            placedAt: order.createdOn.toLocaleString(),
            items: order.OrderItems.map(item => ({
                productName: item.product.name,
                quantity: item.quantity,
                price: item.price
            })),
            shippingAddress: order.address
        };

        res.render("orderPlaced", { order: orderDetails });
    } catch (err) {
        console.error("Error in getOrderPlaced:", err);
        next(err);
    }
};

const loadMyOrders = async (req, res, next) => {
    try {
        if (!req.user) throw new Error("User not authenticated");

        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Number of orders per page
        const skip = (page - 1) * limit;

        const orders = await Order.find({ userId: req.user._id })
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit)
            .populate('OrderItems.product');

        const totalOrders = await Order.countDocuments({ userId: req.user._id });
        const totalPages = Math.ceil(totalOrders / limit);

        const formattedOrders = orders.map(order => ({
            orderId: order.orderId,
            product: order.OrderItems[0].product,
            quantity: order.OrderItems[0].quantity,
            totalAmount: order.finalAmount,
            placedOn: order.createdOn.toLocaleString(),
            status: order.status,
            cancellation_reason: order.cancellation_reason,
            return_reason: order.return_reason
        }));

        res.render("myOrder", {
            orders: formattedOrders,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (err) {
        console.error("Error in loadMyOrders:", err);
        next(err);
    }
};

module.exports = { 
    getOrderPlaced,
    loadMyOrders
};