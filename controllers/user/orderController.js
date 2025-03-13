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
            status: getOrderStatus(order.status), 
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

function getOrderStatus(status) {
    const statusMap = {
      'Pending': 1,
      'Pending COD': 1,
      'Processing': 2,
      'Shipped': 3,
      'Delivered': 4,
      'Return Request': 5,
      'Returned': 6, 
      'Cancelled': 0
    };
    return statusMap[status] || 0;
  }

  const cancelOrder = async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user._id; // Use req.user._id to match walletController
      const { cancellationReason } = req.body || {}; // Default to empty object if req.body is undefined
  
      // Find the order and ensure it’s not delivered (status < 4 based on your status mapping)
      const order = await Order.findOne({ orderId, userId });
      
      if (!order) {
        return res.status(400).json({ 
          success: false, 
          message: 'Order not found' 
        });
      }
  
      // Check if order is not delivered (use numeric status from getOrderStatus)
      const currentStatus = getOrderStatus(order.status);
      if (currentStatus >= 4) { // Assuming 4 is 'Delivered'
        return res.status(400).json({ 
          success: false, 
          message: 'Order cannot be cancelled after delivery' 
        });
      }
  
      // Update order status and store cancellation reason
      order.status = 'Cancelled';
      order.cancellation_reason = cancellationReason || 'No reason provided';
      await order.save();
  
      // Restore product quantities
      for (const item of order.orderedItems) {
        const product = await Product.findById(item.product);
        if (product) {
          const combo = product.combos.find(combo => 
            combo.color === item.color && // Assuming orderedItems has color/size fields; adjust if needed
            combo.size === item.size
          );
          if (combo) {
            combo.quantity += item.quantity;
            await product.save();
          }
        }
      }
  
      // Refund logic: If not COD, transfer amount to user's wallet using walletController
      if (order.paymentMethod !== 'cod') {
        await walletController.addToWallet({
          user: userId, // Pass user ID as part of an object to match walletController's expected format
          amount: order.finalAmount,
          description: `Refund from order #${order.orderId}`
        });
      }
  
      res.json({ success: true });
    } catch (error) {
      console.error('Error in cancelOrder:', error); // Log the error for debugging
      res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
  };

  
  

module.exports = { 
    getOrderPlaced,
    loadMyOrders,
    cancelOrder
};