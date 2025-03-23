const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const walletController = require('./walletController');
const addressController = require('./addressController');
const PDFDocument = require('pdfkit');
const Razorpay = require('razorpay'); // Add Razorpay SDK

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: 'YOUR_RAZORPAY_KEY', // Replace with your Razorpay key
  key_secret: 'YOUR_RAZORPAY_SECRET' // Replace with your Razorpay secret
});

const getOrderPlaced = async (req, res, next) => {
  try {
    if (!req.user) throw new Error("User not authenticated");

    const { orderId, totalAmount, placedAt } = req.query;

    if (!orderId || !totalAmount || !placedAt) {
      return res.status(400).render("orderPlaced", { order: null, message: "Order details not found." });
    }

    const orderDetails = {
      orderId,
      totalAmount: parseFloat(totalAmount).toFixed(2),
      placedAt: new Date(placedAt).toLocaleString()
    };

    res.render("orderPlaced", { order: orderDetails });
  } catch (err) {
    console.error("Error in getOrderPlaced:", err);
    res.status(500).render("error", { message: "Something went wrong. Please try again." });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;
    const { cancellationReason } = req.body || {};

    if (!cancellationReason) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required',
      });
    }

    const order = await Order.findOne({ orderId, userId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const currentStatus = getOrderStatus(order.status);
    if (currentStatus === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled',
      });
    }
    if (currentStatus >= 4) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled after delivery',
      });
    }

    order.status = 'Cancelled';
    order.cancellation_reason = cancellationReason;
    await order.save();

    for (const item of order.OrderItems) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }

    if (order.paymentMethod !== 'cod' && order.paymentStatus === 'success') {
      await walletController.addToWallet({
        user: userId,
        amount: order.finalAmount,
        description: `Refund from order #${order.orderId}`,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error in cancelOrder:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error: ' + error.message 
    });
  }
};

const loadMyOrders = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).render("error", { message: "User not authenticated" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'OrderItems.product',
        select: 'name productImage'
      });

    const totalOrders = await Order.countDocuments({ userId: req.user._id });
    const totalPages = Math.ceil(totalOrders / limit);

    const formattedOrders = orders.map(order => {
      const statusNumber = getOrderStatus(order.status);
      return {
        orderId: order.orderId,
        product: order.OrderItems[0]?.product || { name: 'Unknown Product', productImage: [] },
        quantity: order.OrderItems.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: order.finalAmount,
        placedOn: order.createdOn.toLocaleString(),
        status: statusNumber,
        cancellation_reason: order.cancellation_reason,
        return_reason: order.return_reason
      };
    });

    res.render("myOrder", {
      orders: formattedOrders,
      currentPage: page,
      totalPages: totalPages
    });
  } catch (err) {
    console.error("Error in loadMyOrders:", err);
    res.status(500).render("error", { message: "Something went wrong. Please try again later." });
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

const returnOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;
    const { returnReason } = req.body;

    if (!returnReason) {
      return res.status(400).json({
        success: false,
        message: 'Return reason is required',
      });
    }

    const order = await Order.findOne({ orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.status !== 'Delivered') {
      return res.status(400).json({
        success: false,
        message: 'Only delivered orders can be returned',
      });
    }

    if (order.returnReason) {
      return res.status(400).json({
        success: false,
        message: 'Return already requested',
      });
    }

    order.status = 'Return Request';
    order.returnReason = returnReason;
    await order.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error in returnOrder:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error: ' + error.message 
    });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findOne({ orderId, userId })
      .populate('OrderItems.product')
      .populate('address');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${orderId}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text('Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Order #${order.orderId}`, { align: 'right' });
    doc.text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`, { align: 'right' });

    doc.moveDown();
    doc.fontSize(14).text('Billing Information', { underline: true });
    if (order.address) {
      doc.fontSize(12)
        .text(`Name: ${order.address.name}`)
        .text(`Address: ${order.address.landMark}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}`)
        .text(`Phone: ${order.address.phone}`);
    } else {
      doc.fontSize(12).text('Address: Not available');
    }

    doc.moveDown(2);
    doc.fontSize(14).text('Order Details', { underline: true });

    const tableTop = doc.y + 15;
    const itemX = 50;
    const qtyX = 300;
    const priceX = 400;
    const totalX = 500;

    doc.fontSize(12).font('Helvetica-Bold')
      .text('Item', itemX, tableTop)
      .text('Quantity', qtyX, tableTop)
      .text('Price', priceX, tableTop)
      .text('Total', totalX, tableTop);

    let y = tableTop + 25;
    order.OrderItems.forEach(item => {
      const total = item.quantity * item.price;
      doc.font('Helvetica')
        .text(item.product.productName, itemX, y, { width: 250, ellipsis: true })
        .text(item.quantity, qtyX, y)
        .text(`₹${item.price.toFixed(2)}`, priceX, y)
        .text(`₹${total.toFixed(2)}`, totalX, y);
      y += 20;
    });

    doc.moveDown(2);
    doc.font('Helvetica-Bold')
      .text(`Total Amount: ₹${order.finalAmount.toFixed(2)}`, { align: 'right' });

    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica')
      .text('Thank you for shopping with BAGZO!', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message,
    });
  }
};

const getOrderDetails = async (req, res) => {
  try {
      const order = await Order.findOne({ orderId: req.params.orderId })
          .populate('userId', 'name email phone')
          .populate('OrderItems.product')
          .populate('address'); // Add this line to populate the address reference

      if (!order) {
          return res.status(404).json({ error: 'Order not found' });
      }

      // Log the populated order to verify
      console.log('order:', order);

      // Since address is now populated, use it directly
      const shippingAddress = order.address || {};

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
              address: shippingAddress.address || 'N/A', // Note: your addressSchema uses 'address' as a field
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

// New endpoint to verify Razorpay payment
const verifyPayment = async (req, res) => {
  try {
    const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const userId = req.user._id;

    const order = await Order.findOne({ orderId, userId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify Razorpay signature
    const crypto = require('crypto');
    const generatedSignature = crypto.createHmac('sha256', razorpay.key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Update order status
    order.paymentStatus = 'success';
    order.status = 'Processing'; // Move to next status after payment
    await order.save();

    res.json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    console.error('Error in verifyPayment:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { 
  getOrderPlaced,
  loadMyOrders,
  cancelOrder,
  returnOrder,
  downloadInvoice,
  getOrderDetails,
  verifyPayment
};