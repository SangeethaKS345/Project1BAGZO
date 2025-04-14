const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const walletController = require('./walletController');
const PDFDocument = require('pdfkit');

// Constants for Order Status Tracker
const ORDERS_PER_PAGE = 3;
const STATUS_MAP = {
  'Pending': 1,
  'Pending COD': 1,
  'Failed': -1,
  'Processing': 2,
  'Shipped': 3,
  'Delivered': 4,
  'Return Request': 5,
  'Returned': 6,
  'Cancelled': 0
};

// Helper Functions
const getOrderStatus = (status) => STATUS_MAP[status] || 0;

const validateAuth = (req) => {
  if (!req.user) {
    const err = new Error("User not authenticated");
    err.status = 401;
    throw err;
  }
  return req.user._id;
};

// Main Controllers 
const getOrderPlaced = async (req, res, next) => {
  try {
    validateAuth(req);
    const { orderId, totalAmount, placedAt } = req.query;

    if (!orderId || !totalAmount || !placedAt) {
      const err = new Error("Order details not found");
      err.status = 400;
      throw err;
    }

    const orderDetails = {
      orderId,
      totalAmount: Number(totalAmount).toFixed(2),
      placedAt: new Date(placedAt).toLocaleString()
    };

    res.render("orderPlaced", { order: orderDetails });
  } catch (err) {
    next(err);
  }
};

// Cancel Order
const cancelOrder = async (req, res, next) => {
  try {
    const userId = validateAuth(req);
    const { orderId } = req.params;
    const { cancellationReason } = req.body || {};

    if (!cancellationReason) {
      const err = new Error("Cancellation reason is required");
      err.status = 400;
      throw err;
    }

    const order = await Order.findOne({ orderId, userId });
    if (!order) {
      const err = new Error("Order not found");
      err.status = 404;
      throw err;
    }

    const statusNumber = getOrderStatus(order.status);
    if (statusNumber === 0) {
      const err = new Error("Order is already cancelled");
      err.status = 400;
      throw err;
    }
    if (statusNumber >= 4) {
      const err = new Error("Order cannot be cancelled after delivery");
      err.status = 400;
      throw err;
    }

    await Promise.all([
      Order.updateOne({ _id: order._id }, {
        status: 'Cancelled',
        cancellation_reason: cancellationReason
      }),
      Promise.all(order.OrderItems.map(async item => {
        await Product.updateOne(
          { _id: item.product },
          { $inc: { quantity: item.quantity } }
        );
      }))
    ]);

    if (['razorpay', 'wallet'].includes(order.paymentMethod) && order.finalAmount > 0) {
      await walletController.addWalletTransaction(
        userId,
        order.finalAmount,
        'credit',
        `Refund for cancelled order #${order.orderId}`
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// Load My Orders
const loadMyOrders = async (req, res, next) => {
  try {
    const userId = validateAuth(req);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * ORDERS_PER_PAGE;

    const [orders, totalOrders, user] = await Promise.all([
      Order.find({ userId })
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(ORDERS_PER_PAGE)
        .populate('OrderItems.product')
        .lean(),
      Order.countDocuments({ userId }),
      User.findById(userId).select('name email phone').lean()
    ]);

    const formattedOrders = orders.map(order => {
      console.log(`Order ${order.orderId}: status=${order.status}, paymentStatus=${order.paymentStatus}`);
      let orderStatus = getOrderStatus(order.status);
      if (order.paymentStatus === 'failed') {
        orderStatus = STATUS_MAP['Failed'];
      }

      const orderItems = Array.isArray(order.OrderItems) ? order.OrderItems : [];
      const products = orderItems.map(item => ({
        _id: item.product?._id || 'N/A',
        productName: item.product?.productName || 'N/A',
        productImage: item.product?.productImage || ['default.jpg'],
        quantity: item.quantity || 0,
        price: item.price || 0
      }));

      return {
        orderId: order.orderId,
        products, // Array of all products in the order
        totalQuantity: orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0),
        totalAmount: order.finalAmount || 0,
        placedOn: order.createdOn ? order.createdOn.toLocaleString() : 'N/A',
        deliveredOn: order.deliveredOn ? order.deliveredOn.toISOString() : null, // Add deliveredOn
        status: orderStatus,
        paymentStatus: order.paymentStatus || 'N/A',
        paymentMethod: order.paymentMethod || 'N/A',
        cancellation_reason: order.cancellation_reason,
        return_reason: order.return_reason
      };
    });

    console.log('User data passed to template:', user);
    res.render("myOrder", { 
      orders: formattedOrders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / ORDERS_PER_PAGE),
      user: user
    });
  } catch (err) {
    next(err);
  }
};
// Return Order
const returnOrder = async (req, res, next) => {
  try {
    const userId = validateAuth(req);
    const { orderId } = req.params;
    const { returnReason } = req.body;

    if (!returnReason) {
      const err = new Error("Return reason is required");
      err.status = 400;
      throw err;
    }

    const order = await Order.findOne({ orderId, userId });
    if (!order) {
      const err = new Error("Order not found");
      err.status = 404;
      throw err;
    }
    if (order.status !== 'Delivered') {
      const err = new Error("Only delivered orders can be returned");
      err.status = 400;
      throw err;
    }
    if (order.returnReason) {
      const err = new Error("Return already requested");
      err.status = 400;
      throw err;
    }
    if (order.deliveredOn) {
      const currentDate = new Date();
      const deliveredDate = new Date(order.deliveredOn);
      const diffDays = Math.floor((currentDate - deliveredDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 7) {
        const err = new Error("Return period of 7 days has expired");
        err.status = 400;
        throw err;
      }
    } else {
      const err = new Error("Delivery date not available");
      err.status = 400;
      throw err;
    }

    await Order.updateOne({ _id: order._id }, {
      status: 'Return Request',
      returnReason
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// Download Invoice
const downloadInvoice = async (req, res, next) => {
  try {
    const userId = validateAuth(req);
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId, userId })
      .populate('OrderItems.product')
      .populate('address')
      .lean();

    if (!order) {
      const err = new Error("Order not found");
      err.status = 404;
      throw err;
    }

    const statusNumber = getOrderStatus(order.status);
    // Allow invoice download only if payment is successful or COD, block :- failed, pending Razorpay, cancelled, or returned
    if (order.paymentStatus === 'failed' || 
        (order.paymentMethod === 'razorpay' && order.paymentStatus === 'pending') || 
        statusNumber === 0 || 
        statusNumber === 6) {
      const err = new Error("Invoice not available for failed, pending Razorpay, cancelled, or returned orders");
      err.status = 403;
      throw err;
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${orderId}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text('Invoice', { align: 'center' })
      .moveDown()
      .fontSize(12)
      .text(`Order #${order.orderId}`, { align: 'right' })
      .text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`, { align: 'right' })
      .moveDown()
      .fontSize(14).text('Billing Information', { underline: true })
      .fontSize(12);

    if (order.address) {
      doc.text(`Name: ${order.address.name}`)
        .text(`Address: ${[order.address.landMark, order.address.city, order.address.state, order.address.pincode].join(', ')}`)
        .text(`Phone: ${order.address.phone}`);
    } else {
      doc.text('Address: Not available');
    }

    doc.moveDown(2).fontSize(14).text('Order Details', { underline: true });
    const tableTop = doc.y + 15;
    const positions = { item: 50, qty: 300, price: 400, total: 500 };

    doc.font('Helvetica-Bold').fontSize(12)
      .text('Item', positions.item, tableTop)
      .text('Quantity', positions.qty, tableTop)
      .text('Price', positions.price, tableTop)
      .text('Total', positions.total, tableTop);

    let y = tableTop + 25;
    order.OrderItems.forEach(item => {
      const total = item.quantity * item.price;
      doc.font('Helvetica')
        .text(item.product.productName, positions.item, y, { width: 250, ellipsis: true })
        .text(item.quantity, positions.qty, y)
        .text(`₹${item.price.toFixed(2)}`, positions.price, y)
        .text(`₹${total.toFixed(2)}`, positions.total, y);
      y += 20;
    });

    doc.moveDown(2)
      .font('Helvetica-Bold')
      .text(`Total Amount: ₹${order.finalAmount.toFixed(2)}`, { align: 'right' })
      .moveDown(2)
      .fontSize(10)
      .text('Thank you for shopping with BAGZO!', { align: 'center' });

    doc.end();

    console.log('orderId:', orderId, 'paymentStatus:', order.paymentStatus, 'status:', order.status, 'paymentMethod:', order.paymentMethod);
  } catch (err) {
    next(err);
  }
};

// Get Order Details
const getOrderDetails = async (req, res, next) => {
  try {
    const userId = validateAuth(req);
    const { orderId } = req.params;

    const [order, user] = await Promise.all([
      Order.findOne({ orderId, userId })
        .populate('OrderItems.product')
        .populate('address')
        .lean(),
      User.findById(userId).select('name email').lean()
    ]);

    if (!order) {
      const err = new Error("Order not found");
      err.status = 404;
      throw err;
    }
    if (!user) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        orderDate: order.createdOn,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        finalAmount: order.finalAmount,
        userName: user.name,
        userEmail: user.email,
        shippingAddress: {
          name: order.address?.name,
          houseNo: order.address?.houseNo,
          landMark: order.address?.landMark,
          city: order.address?.city,
          state: order.address?.state,
          pincode: order.address?.pincode,
          phone: order.address?.phone,
          altPhone: order.address?.altPhone 
        },
        orderedItems: order.OrderItems.map(item => ({
          product: { productName: item.product.productName },
          price: item.price,
          quantity: item.quantity
        })),
        status: order.status
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOrderPlaced,
  loadMyOrders,
  cancelOrder,
  returnOrder,
  downloadInvoice,
  getOrderDetails
};