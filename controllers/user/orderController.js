const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema'); 
const walletController = require('./walletController'); 
const addressController = require('./addressController');
const PDFDocument = require('pdfkit');

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
                productName: item.product.productName,
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
    order.cancellation_reason = cancellationReason; // Always set this
    await order.save();

    for (const item of order.OrderItems) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }

    if (order.paymentMethod !== 'cod') {
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

const loadMyOrders = async (req, res, next) => {
  try {
    if (!req.user) throw new Error("User not authenticated");

    const page = parseInt(req.query.page) || 1;
    const limit = 3; 
    const skip = (page - 1) * limit;

    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .populate('OrderItems.product');

    const totalOrders = await Order.countDocuments({ userId: req.user._id });
    const totalPages = Math.ceil(totalOrders / limit);

    const formattedOrders = orders.map(order => {
      const statusNumber = getOrderStatus(order.status);
      console.log(`Order #${order.orderId} - Status: ${order.status} (Mapped: ${statusNumber})`);
      return {
        orderId: order.orderId,
        product: order.OrderItems[0].product,
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

    console.log(`User ${userId} is requesting invoice for order ${orderId}`);

    // Fetch order details with populated fields
    const order = await Order.findOne({ orderId, userId })
      .populate('OrderItems.product')
      .populate('address');

    if (!order) {
      console.log(`Order ${orderId} not found for user ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    console.log(`Order ${orderId} found for user ${userId}`);

    // Create a new PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${orderId}.pdf`);

    // Pipe the PDF into the response
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Order #${order.orderId}`, { align: 'right' });
    doc.text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`, { align: 'right' });

    // Billing Information
    const address = order.address.address[0]; // Assuming first address in array
    doc.moveDown();
    doc.fontSize(14).text('Billing Information', { underline: true });
    doc.fontSize(12)
      .text(`Name: ${address.name}`)
      .text(`Address: ${address.landMark}, ${address.city}, ${address.state} - ${address.pincode}`)
      .text(`Phone: ${address.phone}`);

    // Order Details Table
    doc.moveDown(2);
    doc.fontSize(14).text('Order Details', { underline: true });

    // Table Header
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

    // Table Content
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

    // Total Amount
    doc.moveDown(2);
    doc.font('Helvetica-Bold')
      .text(`Total Amount: ₹${order.finalAmount.toFixed(2)}`, { align: 'right' });

    // Footer
    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica')
      .text('Thank you for shopping with BAGZO!', { align: 'center' });

    // Finalize the PDF
    doc.end();

    console.log(`Invoice for order ${orderId} generated successfully`);

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message,
    });
  }
};

module.exports = { 
  getOrderPlaced,
  loadMyOrders,
  cancelOrder,
  returnOrder,
  downloadInvoice
};