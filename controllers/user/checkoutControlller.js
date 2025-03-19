const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const Order = require('../../models/orderSchema');
const razorpay = require('../../config/razorpay');

const getCartPage = async (req, res) => {
  try {
    const cartData = await getCartDataForUser(req.user._id);
    res.render('cart', { cartData, user: req.user });
  } catch (error) {
    console.error('Error fetching cart data:', error.stack);
    res.status(500).send('Internal Server Error');
  }
};

const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.user._id;

    const addresses = await Address.find({ userId }).lean() || [];
    console.log("Fetched addresses:", addresses);

    const cartItems = await getCartDataForUser(userId);
    if (!cartItems || cartItems.length === 0) {
      req.session.error = "Your cart is . Add items before checking out.";
      return res.redirect("/cart");
    }

    const cartSubtotal = cartItems.reduce((sum, item) => {
      const salesPrice = item.productDetails?.salesPrice || 0;
      const quantity = item.quantity || 0;
      return sum + salesPrice * quantity;
    }, 0);
    const finalAmount = cartSubtotal;

    res.render('checkout', { 
      user: req.user, 
      addresses, 
      cartItems, 
      cartSubtotal, 
      finalAmount,
      error: req.session.error || null 
    });
    req.session.error = null;
  } catch (error) {
    console.error('Error fetching checkout data:', error.stack);
    res.status(500).send('Internal Server Error');
  }
};

async function getCartDataForUser(userId) {
  try {
    const cart = await Cart.findOne({ userId }).populate('products.productId').lean();
    if (!cart || !cart.products || cart.products.length === 0) {
      console.log("No cart or products found for user:", userId);
      return [];
    }

    const populatedProducts = await Promise.all(cart.products.map(async (product) => {
      if (!product.productId) {
        console.warn(`Cart item has no productId: ${JSON.stringify(product)}`);
        return null;
      }
      const productDetails = await Product.findById(product.productId).lean();
      if (!productDetails) {
        console.warn(`Product not found for ID: ${product.productId}`);
        return null;
      }
      const categoryDetails = await Category.findById(productDetails.category).lean();
      const brandDetails = await Brand.findById(productDetails.brand).lean();

      return {
        ...product,
        productDetails,
        categoryDetails,
        brandDetails
      };
    }));

    const validProducts = populatedProducts.filter(item => item !== null && item.productDetails);
    console.log("Valid Cart Products:", validProducts);
    return validProducts;
  } catch (error) {
    console.error('Error fetching cart data for user:', error.stack);
    return [];
  }
}

const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod } = req.body;
    const userId = req.user._id;

    console.log("Place Order Request Body:", req.body);
    console.log("User ID:", userId);

    // Validate inputs
    if (!addressId || !paymentMethod) {
      return res.status(400).json({ success: false, error: 'Address and payment method are required' });
    }

    // Fetch cart items
    const cartItems = await getCartDataForUser(userId);
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }

    // Verify all items have valid productDetails
    const invalidItems = cartItems.filter(item => !item.productDetails || !item.productDetails._id);
    if (invalidItems.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cart contains invalid or missing product data' 
      });
    }

    // Check quantity limits
    const exceedsLimit = cartItems.some(item => item.quantity > 5);
    if (exceedsLimit) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quantity limit exceeded. Maximum 5 items per product allowed.' 
      });
    }

    // Calculate total
    const finalAmount = cartItems.reduce((sum, item) => {
      const price = item.productDetails?.salesPrice || 0;
      return sum + (price * item.quantity);
    }, 0);

    // Validate selected address
    const selectedAddress = await Address.findById(addressId).lean();
    if (!selectedAddress || selectedAddress.userId.toString() !== userId.toString()) {
      return res.status(400).json({ success: false, error: 'Invalid address selected' });
    }

    // Create order in MongoDB
    const order = new Order({
      userId: userId, 
      OrderItems: cartItems.map(item => ({
        product: item.productDetails._id,
        quantity: item.quantity,
        price: item.productDetails.salesPrice
      })),
      totalPrice: finalAmount,
      finalAmount: finalAmount,
      address: addressId,
      status: paymentMethod === 'razorpay' ? 'Pending' : 'Processing', // Pending for Razorpay until payment is verified
      paymentMethod: paymentMethod
    });

    await order.save();

    if (paymentMethod === 'razorpay') {
      const razorpayOrder = await razorpay.orders.create({
        amount: finalAmount * 100, // Convert to paise
        currency: 'INR',
        receipt: order.orderId
      });
    
      return res.json({
        success: true,
        key: process.env.RAZORPAY_KEY_ID,
        amount: razorpayOrder.amount,
        razorpayOrderId: razorpayOrder.id,
        orderId: order._id // Send MongoDB order ID for verification
      });
    }

    // For COD, clear cart immediately
    await Cart.updateOne({ userId: userId }, { $set: { products: [] } });
    res.json({ 
      success: true, 
      redirect: '/orderPlaced', 
      order: { 
        orderId: order.orderId, 
        totalAmount: order.finalAmount, 
        placedAt: order.createdOn 
      } 
    });
  } catch (error) {
    console.error('Error placing order:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to place order due to a server error' 
    });
  }
};

// Add new endpoint to verify payment
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;
    const crypto = require('crypto');

    // Verify Razorpay signature
    const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    // Update order status after successful payment
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    order.status = 'Processing';
    await order.save();

    // Clear the cart after successful payment
    await Cart.updateOne({ userId: order.userId }, { $set: { products: [] } });

    res.json({ 
      success: true, 
      redirect: '/orderPlaced', 
      order: { 
        orderId: order.orderId, 
        totalAmount: order.finalAmount, 
        placedAt: order.createdOn 
      } 
    });
  } catch (error) {
    console.error('Error verifying payment:', error.stack);
    res.status(500).json({ 
      success: false, 
      redirect: `/orderFailure?message=${encodeURIComponent('Payment verification failed')}&orderId=${orderId || ''}&totalAmount=${order ? order.finalAmount : 0}`
    });
}
if (generatedSignature !== razorpay_signature) {
  return res.status(400).json({ 
    success: false, 
    redirect: `/orderFailure?message=${encodeURIComponent('Invalid payment signature')}&orderId=${orderId || ''}&totalAmount=${order ? order.finalAmount : 0}`
  });
}
};

const getOrderFailurePage = async (req, res) => {
  try {
    const { message, orderId, totalAmount } = req.query;
    let order = null;

    if (orderId) {
      const foundOrder = await Order.findOne({ orderId }).lean();
      if (foundOrder) {
        order = {
          orderId: foundOrder.orderId,
          totalAmount: totalAmount || foundOrder.finalAmount,
        };
      } else {
        // If no order is found, use the query params directly or set minimal data
        order = {
          orderId: orderId,
          totalAmount: totalAmount || 0,
        };
      }
    }

    res.render('orderFailure', { 
      message: message || 'An unknown error occurred',
      order: order || null,
      user: req.user
    });
  } catch (error) {
    console.error('Error rendering order failure page:', error.stack);
    res.status(500).send('Internal Server Error');
  }
};

const retryPayment = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    if (!req.user) throw new Error("User not authenticated");

    // Fetch the failed order
    const order = await Order.findOne({ orderId, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Check if the order is eligible for retry
    if (order.status !== 'Pending' && order.status !== 'Cancelled') {
      return res.status(400).json({ success: false, error: 'Payment retry not allowed for this order status' });
    }

    // Generate a new Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: order.finalAmount * 100, // Amount in paise
      currency: 'INR',
      receipt: order.orderId,
    });

    // Update the order with the new Razorpay order ID and increment payment attempts
    order.razorpayOrderId = razorpayOrder.id;
    order.paymentAttempts = (order.paymentAttempts || 0) + 1;
    await order.save();

    // Return JSON response for the Razorpay modal
    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      razorpayOrderId: razorpayOrder.id,
      orderId: order._id, // MongoDB Order ID for verification
    });
  } catch (err) {
    console.error('Error in retryPayment:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

const verifyRetryPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;
    const crypto = require('crypto');

    // Verify Razorpay signature
    const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    // Update order status after successful payment
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    order.status = 'Processing';
    await order.save();

    res.json({ 
      success: true, 
      redirect: '/orderPlaced', 
      order: { 
        orderId: order.orderId, 
        totalAmount: order.finalAmount, 
        placedAt: order.createdOn 
      } 
    });
  } catch (error) {
    console.error('Error verifying retry payment:', error);
    res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
};

module.exports = {
  getCartPage,
  getCheckoutPage,
  getCartDataForUser,
  placeOrder,
  verifyPayment,
  getOrderFailurePage,
  retryPayment
};