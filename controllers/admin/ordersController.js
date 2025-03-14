const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");

const getAllOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 6;

        const searchText = req.query.search ? req.query.search.toLowerCase() : '';

        const orders = await Order.find()
            .populate('userId')
            .populate('OrderItems.product')
            .sort({ createdOn: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const totalOrders = await Order.countDocuments();

        const formattedOrders = orders.map(order => ({
            _id: order.orderId,
            date: order.createdOn,
            customer: order.userId.name,
            products: order.OrderItems.map(item => {
                const imagePath = item.product.productImage[0];
                const formattedImagePath = `/uploads/re-image/${imagePath}`;
                return {
                    name: item.product.productName,
                    image: formattedImagePath,
                    quantity: item.quantity,
                    color: item.product.color
                };
            }),
            total: order.finalAmount,
            payment: order.paymentMethod,
            status: order.status
        })).filter(order => order.products.some(product => product.name.toLowerCase().includes(searchText)));

        res.render('orders', { 
            orders: formattedOrders,
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit)
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Error fetching orders');
    }
};

const getOrderDetails = async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId })
            .populate('userId', 'name email phone')
            .populate('OrderItems.product') // Populate address reference
            console.log('order:', order);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        
        const shippingAddress = order.address && order.address.address && order.address.address.length > 0 
            ? order.address.address[0] 
            : {};
            console.log('shippingAddress:', shippingAddress);

        const formattedOrder = {
            _id: order.orderId,
            date: order.createdOn,
            payment: order.paymentMethod,
            total: order.finalAmount,
            customer: {
                name: order.userId?.name || 'N/A',
                email: order.userId?.email || 'N/A',
                phone: order.userId?.phone || 'N/A'
            },
            shippingAddress: {
                fullName: shippingAddress.name || 'N/A',
                address: shippingAddress.address || 'N/A',
                landMark: shippingAddress.landMark || 'N/A',
                city: shippingAddress.city || 'N/A',
                state: shippingAddress.state || 'N/A',
                pincode: shippingAddress.pincode || 'N/A',
                phone: shippingAddress.phone || 'N/A',
                altPhone: shippingAddress.altPhone || 'N/A'
            },
            products: order.OrderItems.map(item => {
                const imagePath = item.product.productImage[0];
                const formattedImagePath = `/uploads/re-image/${imagePath}`;
                return {
                    name: item.product.productName,
                    image: formattedImagePath,
                    price: item.price,
                    color: item.product.color,
                    quantity: item.quantity,
                    status: order.status
                };
            })
        };

        res.json(formattedOrder);
    } catch (error) {
        console.error('Error in getOrderDetails:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const order = await Order.findOne({ orderId: orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.status === 'Cancelled' || order.status === 'Returned') {
            return res.status(400).json({ 
                error: `Cannot modify status of a ${order.status.toLowerCase()} order` 
            });
        }

        order.status = status;
        await order.save();

        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getReturnRequests = async (req, res) => {
    try {
        const returnRequests = await Order.find({ status: 'Return Request' })
            .populate('userId', 'name')
            .populate('OrderItems.product');

        const formattedRequests = returnRequests.map(order => ({
            _id: order.orderId,
            customer: order.userId.name,
            products: order.OrderItems.map(item => ({
                name: item.product.productName,
                quantity: item.quantity
            })),
            total: order.finalAmount,
            returnReason: order.returnReason || 'Not specified', // Ensure it’s always present
            status: order.status
        }));

        res.json(formattedRequests);
    } catch (error) {
        console.error('Error fetching return requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const updateReturnStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const order = await Order.findOne({ orderId: orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.status !== 'Return Request') {
            return res.status(400).json({ error: 'Order is not in Return Request status' });
        }

        if (order.status === 'Cancelled' || order.status === 'Returned') {
            return res.status(400).json({ 
                error: `Cannot modify status of a ${order.status.toLowerCase()} order` 
            });
        }

        order.status = status;
        await order.save();

        res.json({ message: 'Order status updated to Returned successfully' });
    } catch (error) {
        console.error('Error updating return status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getAllOrders,
    getOrderDetails,
    updateOrderStatus,
    getReturnRequests,
    updateReturnStatus,
};