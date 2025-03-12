

const Order = require('../../models/orderSchema');

const getOrderPlaced = async (req, res, next) => {
    try {
        console.log("Accessed /orderPlaced route");
        console.log("req.user:", req.user);
        if (!req.user) throw new Error("User not authenticated");

        console.log("Querying order for userId:", req.user._id);
        const order = await Order.findOne({ userId: req.user._id })
            .sort({ createdOn: -1 })
            .populate('OrderItems.product')
            .populate('address');
        console.log("Order result:", order);

        if (!order) {
            console.log("No order found for userId:", req.user._id);
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
        console.log("Order details:", orderDetails);

        res.render("orderPlaced", { order: orderDetails }); // Correct path
    } catch (err) {
        console.error("Error in getOrderPlaced:", err);
        next(err);
    }
};

module.exports = { getOrderPlaced };

