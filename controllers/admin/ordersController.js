const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Wallet = require("../../models/walletSchema");

// Load all orders for admin
const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const search = req.query.search ? req.query.search.trim() : '';
    const status = req.query.status || '';
    const sort = req.query.sort || 'new-to-old';

    // Build query
    let query = {};
    if (status && status !== '') {
      query.status = status;
    }

    // Sorting logic
    let sortOption = {};
    switch (sort) {
      case 'new-to-old':
        sortOption = { createdOn: -1 };
        break;
      case 'old-to-new':
        sortOption = { createdOn: 1 };
        break;
      case 'a-to-z':
        sortOption = { 'userId.name': 1 };
        break;
      case 'z-to-a':
        sortOption = { 'userId.name': -1 };
        break;
      default:
        sortOption = { createdOn: -1 };
    }

    // Aggregation pipeline for searching
    let orders = [];
    let totalOrders = 0;

    if (search) {
      // Search by product name
      const products = await Product.find({
        productName: { $regex: search, $options: 'i' },
      }).select('_id');

      const productIds = products.map(p => p._id);

      // Search by order ID (partial match)
      query.$or = [
        { 'OrderItems.product': { $in: productIds } },
        { orderId: { $regex: search, $options: 'i' } },
      ];

      orders = await Order.aggregate([
        {
          $match: query,
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userId',
          },
        },
        {
          $unwind: { path: '$userId', preserveNullAndEmptyArrays: true },
        },
        {
          $lookup: {
            from: 'products',
            localField: 'OrderItems.product',
            foreignField: '_id',
            as: 'OrderItems_product',
          },
        },
        {
          $sort: sortOption,
        },
        {
          $skip: (page - 1) * limit,
        },
        {
          $limit: limit,
        },
      ]);

      const countResult = await Order.aggregate([
        {
          $match: query,
        },
        {
          $count: 'total',
        },
      ]);
      totalOrders = countResult.length > 0 ? countResult[0].total : 0;
    } else {
      [orders, totalOrders] = await Promise.all([
        Order.find(query)
          .populate('userId', 'name')
          .populate('OrderItems.product')
          .sort(sortOption)
          .skip((page - 1) * limit)
          .limit(limit),
        Order.countDocuments(query),
      ]);
    }

    // Format orders
    const formattedOrders = orders.map(order => ({
      _id: order.orderId,
      date: order.createdOn,
      customer: order.userId ? order.userId.name : 'N/A',
      products: order.OrderItems.map(item => {
        const product = search
          ? order.OrderItems_product.find(p => p._id.toString() === item.product.toString())
          : item.product;
        return {
          name: product ? product.productName : 'N/A',
          image: product ? `/Uploads/re-image/${product.productImage[0]}` : '',
          quantity: item.quantity,
          color: product ? product.color : 'N/A',
        };
      }),
      total: order.finalAmount,
      payment: order.paymentMethod,
      status: order.status,
    }));

    res.render('orders', {
      orders: formattedOrders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      search,
      status,
      sort,
      queryParams: `search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&sort=${encodeURIComponent(sort)}`,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).send('Error fetching orders');
  }
};

// New endpoint for search suggestions
const getSearchSuggestions = async (req, res) => {
  try {
    const search = req.query.q ? req.query.q.trim() : '';
    if (!search) {
      return res.json([]);
    }

    // Search products
    const products = await Product.find({
      productName: { $regex: search, $options: 'i' },
    })
      .select('productName')
      .limit(5);

    // Search orders by orderId
    const orders = await Order.find({
      orderId: { $regex: search, $options: 'i' },
    })
      .select('orderId')
      .limit(5);

    const suggestions = [
      ...products.map(p => ({ type: 'Product', value: p.productName })),
      ...orders.map(o => ({ type: 'Order ID', value: o.orderId })),
    ];

    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json([]);
  }
};

// Load order details for admin
const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate('userId', 'name email phone')
      .populate('OrderItems.product')
      .populate('address');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const shippingAddress = order.address || {};

    const formattedOrder = {
      _id: order.orderId,
      date: order.createdOn,
      payment: order.paymentMethod,
      total: order.finalAmount,
      customer: {
        name: order.userId?.name || 'N/A',
        email: order.userId?.email || 'N/A',
        phone: order.userId?.phone || 'N/A',
      },
      shippingAddress: {
        fullName: shippingAddress.name || 'N/A',
        landMark: shippingAddress.landMark || 'N/A',
        city: shippingAddress.city || 'N/A',
        state: shippingAddress.state || 'N/A',
        pincode: shippingAddress.pincode || 'N/A',
        phone: shippingAddress.phone || 'N/A',
        altPhone: shippingAddress.altPhone || 'N/A',
      },
      products: order.OrderItems.map(item => ({
        name: item.product.productName,
        image: `/Uploads/re-image/${item.product.productImage[0]}`,
        price: item.price,
        color: item.product.color,
        quantity: item.quantity,
        status: order.status,
      })),
    };

    res.json(formattedOrder);
  } catch (error) {
    console.error('Error in getOrderDetails:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Update order status for admin
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findOne({ orderId }).populate('OrderItems.product');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (['Cancelled', 'Returned', 'Delivered'].includes(order.status)) {
      return res.status(400).json({
        error: `Cannot modify status of a ${order.status.toLowerCase()} order`,
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

// Get return requests for admin
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
        quantity: item.quantity,
      })),
      total: order.finalAmount,
      returnReason: order.returnReason || 'Not specified',
      status: order.status,
    }));

    res.json(formattedRequests);
  } catch (error) {
    console.error('Error fetching return requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update return status for admin
const updateReturnStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, action } = req.body;

    const order = await Order.findOne({ orderId })
      .populate('userId')
      .populate('OrderItems.product');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'Return Request') {
      return res.status(400).json({ error: 'Order is not in Return Request status' });
    }

    if (['Cancelled', 'Returned'].includes(order.status)) {
      return res.status(400).json({
        error: `Cannot modify status of a ${order.status.toLowerCase()} order`,
      });
    }

    order.status = status;
    await order.save();

    if (action === 'accept' && status === 'Returned') {
      let wallet = await Wallet.findOne({ user: order.userId._id });
      if (!wallet) {
        wallet = new Wallet({ user: order.userId._id, balance: 0, transactions: [] });
      }

      const refundAmount = order.finalAmount;
      wallet.balance += refundAmount;
      wallet.transactions.push({
        type: 'credit',
        amount: refundAmount,
        description: `Refund for order ${order.orderId}`,
        date: new Date(),
      });
      await wallet.save();

      for (const item of order.OrderItems) {
        const product = item.product;
        product.quantity += item.quantity;
        if (product.quantity > 0 && product.status === 'out of stock') {
          product.status = 'Available';
        }
        await product.save();
      }
    }

    res.json({ message: `Order status updated to ${status} successfully` });
  } catch (error) {
    console.error('Error updating return status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get order details for payment retry
const getOrderDetailsForPayment = async (req, res, next) => {
  try {
    const userId = validateAuth(req);
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId, userId })
      .populate('userId', 'name email')
      .populate('address')
      .lean();

    if (!order) {
      const err = new Error('Order not found');
      err.status = 404;
      throw err;
    }

    if (order.paymentStatus !== 'failed') {
      const err = new Error('Payment retry only available for failed payments');
      err.status = 400;
      throw err;
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        amount: order.finalAmount,
        customerName: order.userId.name,
        customerEmail: order.userId.email,
        customerPhone: order.address.phone,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllOrders,
  getOrderDetails,
  updateOrderStatus,
  getReturnRequests,
  updateReturnStatus,
  getOrderDetailsForPayment,
};