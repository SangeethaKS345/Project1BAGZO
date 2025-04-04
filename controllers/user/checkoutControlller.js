const mongoose = require("mongoose");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const razorpay = require("../../config/razorpay");
const Wallet = require("../../models/walletSchema");
const { addWalletTransaction } = require("../../controllers/user/walletController");
const OrderSequence = require('../../models/orderSequenceSchema');

const getCartPage = async (req, res) => {
  try {
    const cartData = await getCartDataForUser(req.user._id);
    res.render("cart", { cartData, user: req.user });
  } catch (error) {
    console.error("Error fetching cart data:", error.stack);
    res.status(500).send("Internal Server Error");
  }
};

const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.user._id;
    const [addresses, cartItems] = await Promise.all([
      Address.find({ userId }).lean(),
      getCartDataForUser(userId)
    ]);

    if (!cartItems.length) {
      req.session.error = "Your cart is empty. Add items before checking out.";
      return res.redirect("/cart");
    }

    const cartSubtotal = cartItems.reduce((sum, item) => sum + (item.productDetails?.salesPrice || 0) * item.quantity, 0);
    const wallet = await Wallet.findOne({ user: userId });
    const walletBalance = wallet ? wallet.balance : 0;

    const coupons = await Coupon.find({
      isListed: true,
      isDeleted: false,
      startOn: { $lte: new Date() },
      expireOn: { $gte: new Date() },
      $expr: { $lt: ["$usesCount", "$maxUses"] },
    }).lean();

    const availableCoupons = coupons.filter(coupon => {
      const userUse = coupon.userUses.find(use => use.userId.toString() === userId.toString());
      return !userUse || userUse.count < coupon.maxUsesPerUser;
    });

    res.render("checkout", {
      user: req.user,
      addresses,
      cartItems,
      cartSubtotal,
      finalAmount: cartSubtotal,
      walletBalance,
      coupons: availableCoupons,
      error: req.session.error || null,
    });

    req.session.error = null;
  } catch (error) {
    console.error("Error fetching checkout data:", error.stack);
    res.status(500).send("Internal Server Error");
  }
};

async function getCartDataForUser(userId) {
  try {
    let cart = await Cart.findOne({ userId }).populate("products.productId");
    if (!cart || !cart.products.length) {
      console.log("No cart or products found for user:", userId);
      return [];
    }

    // Remove out-of-stock products
    const outOfStockProducts = [];
    cart.products = cart.products.filter(item => {
      const product = item.productId;
      if (!product || product.quantity <= 0 || product.status === "out of stock" || product.isBlocked) {
        outOfStockProducts.push(product ? product.productName : "Unknown Product");
        return false;
      }
      return true;
    });

    if (outOfStockProducts.length > 0) {
      await cart.save();
      console.log(`Removed out-of-stock products from cart: ${outOfStockProducts.join(", ")}`);
    }

    const populatedProducts = await Promise.all(
      cart.products.map(async product => {
        if (!product.productId) {
          console.warn(`Cart item has no productId: ${JSON.stringify(product)}`);
          return null;
        }
        const productDetails = await Product.findById(product.productId).lean();
        if (!productDetails) {
          console.warn(`Product not found for ID: ${product.productId}`);
          return null;
        }

        const [categoryDetails, brandDetails] = await Promise.all([
          Category.findById(productDetails.category).lean(),
          Brand.findById(productDetails.brand).lean()
        ]);

        return {
          ...product.toObject(), // Convert Mongoose document to plain object
          productDetails,
          categoryDetails,
          brandDetails
        };
      })
    );

    return populatedProducts.filter(item => item && item.productDetails);
  } catch (error) {
    console.error("Error fetching cart data for user:", error.stack);
    return [];
  }
}

async function generateOrderId() {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const sequenceDoc = await OrderSequence.findOneAndUpdate(
    { date: dateStr },
    { $inc: { sequence: 1 } },
    { upsert: true, new: true }
  );

  return `ORD${dateStr}${String(sequenceDoc.sequence).padStart(3, '0')}`;
}

const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod, couponCode } = req.body;
    const userId = req.user._id;

    if (!addressId || !paymentMethod) {
      return res.status(400).json({ success: false, error: "Address and payment method are required" });
    }

    const cartItems = await getCartDataForUser(userId);
    if (!cartItems.length) {
      return res.status(400).json({ success: false, error: "Cart is empty" });
    }

    const invalidItems = cartItems.filter(item => !item.productDetails || !item.productDetails._id);
    if (invalidItems.length) {
      return res.status(400).json({ success: false, error: "Cart contains invalid or missing product data" });
    }

    if (cartItems.some(item => item.quantity > 5)) {
      return res.status(400).json({ success: false, error: "Quantity limit exceeded. Maximum 5 items per product allowed." });
    }

    // Check stock availability before proceeding
    for (const item of cartItems) {
      const product = await Product.findById(item.productDetails._id);
      if (!product || product.quantity < item.quantity) {
        throw new Error(`Insufficient stock for product: ${item.productDetails.productName}`);
      }
    }

    const finalAmount = cartItems.reduce((sum, item) => sum + (item.productDetails?.salesPrice || 0) * item.quantity, 0);
    let discount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isListed: true,
        isDeleted: false,
        startOn: { $lte: new Date() },
        expireOn: { $gte: new Date() },
      });

      if (!coupon) {
        throw new Error("Invalid or expired coupon");
      }

      if (finalAmount < coupon.minimumPrice) {
        throw new Error(`Minimum purchase of ₹${coupon.minimumPrice} required`);
      }

      if (coupon.usesCount >= coupon.maxUses) {
        throw new Error("Coupon total usage limit reached");
      }

      const userUse = coupon.userUses.find(use => use.userId.toString() === userId.toString());
      const userUsageCount = userUse ? userUse.count : 0;
      if (userUsageCount >= coupon.maxUsesPerUser) {
        throw new Error("You have reached your usage limit for this coupon");
      }

      discount = coupon.offerPrice;
      coupon.usesCount += 1;
      if (userUse) {
        userUse.count += 1;
      } else {
        coupon.userUses.push({ userId, count: 1 });
      }
      await coupon.save();
      appliedCoupon = coupon;
    }

    const discountedAmount = finalAmount - discount;
    const selectedAddress = await Address.findById(addressId).lean();

    if (!selectedAddress || selectedAddress.userId.toString() !== userId.toString()) {
      throw new Error("Invalid address selected");
    }

    const customOrderId = await generateOrderId();

    const order = new Order({
      orderId: customOrderId,
      userId,
      OrderItems: cartItems.map(item => ({
        product: item.productDetails._id,
        quantity: item.quantity,
        price: item.productDetails.salesPrice,
      })),
      totalPrice: finalAmount,
      finalAmount: discountedAmount,
      address: addressId,
      status: paymentMethod === "razorpay" ? "Pending" : "Processing",
      paymentMethod,
      couponCode: couponCode || null,
      discount,
    });

    await order.save();

    // Decrease stock for each product
    const stockUpdates = [];
    for (const item of cartItems) {
      const result = await Product.updateOne(
        { _id: item.productDetails._id, quantity: { $gte: item.quantity } }, // Ensure stock is still sufficient
        { $inc: { quantity: -item.quantity } }
      );
      if (result.nModified === 0) {
        throw new Error(`Failed to update stock for product: ${item.productDetails.productName}`);
      }
      stockUpdates.push({ productId: item.productDetails._id, quantity: item.quantity });
    }

    if (paymentMethod === "razorpay") {
      try {
        const razorpayOrder = await razorpay.orders.create({
          amount: discountedAmount * 100,
          currency: "INR",
          receipt: order.orderId,
        });
        order.razorpayOrderId = razorpayOrder.id;
        await order.save();
        return res.json({
          success: true,
          key: process.env.RAZORPAY_KEY_ID,
          amount: razorpayOrder.amount,
          razorpayOrderId: razorpayOrder.id,
          orderId: order._id,
        });
      } catch (error) {
        // Rollback stock changes if Razorpay order creation fails
        for (const update of stockUpdates) {
          await Product.updateOne(
            { _id: update.productId },
            { $inc: { quantity: update.quantity } }
          );
        }
        order.status = "Failed";
        order.paymentStatus = "failed";
        await order.save();
        throw error;
      }
    }

    if (paymentMethod === "wallet") {
      try {
        await addWalletTransaction(userId, discountedAmount, "debit", `Payment for order #${order.orderId}`);
      } catch (error) {
        // Rollback stock changes if wallet transaction fails
        for (const update of stockUpdates) {
          await Product.updateOne(
            { _id: update.productId },
            { $inc: { quantity: update.quantity } }
          );
        }
        throw new Error(error.message);
      }

      await Cart.updateOne({ userId }, { $set: { products: [] } });
      return res.json({
        success: true,
        redirect: "/orderPlaced",
        order: {
          orderId: order.orderId,
          totalAmount: order.finalAmount,
          placedAt: order.createdOn,
        },
      });
    }

    await Cart.updateOne({ userId }, { $set: { products: [] } });
    res.json({
      success: true,
      redirect: "/orderPlaced",
      order: {
        orderId: order.orderId,
        totalAmount: order.finalAmount,
        placedAt: order.createdOn,
      },
    });
  } catch (error) {
    console.error("Error placing order:", error.stack);
    res.status(500).json({ success: false, error: error.message || "Failed to place order due to a server error" });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;
    const crypto = require("crypto");

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (generatedSignature !== razorpay_signature) {
      order.status = "Failed";
      order.paymentStatus = "failed";
      await order.save();
      return res.status(400).json({ success: false, error: "Invalid payment signature" });
    }

    order.status = "Processing";
    order.paymentStatus = "success";
    await order.save();

    await Cart.updateOne({ userId: order.userId }, { $set: { products: [] } });

    res.json({
      success: true,
      redirect: "/orderPlaced",
      order: {
        orderId: order.orderId,
        totalAmount: order.finalAmount,
        placedAt: order.createdOn,
      },
    });
  } catch (error) {
    console.error("Error verifying payment:", error.stack);
    const order = await Order.findById(req.body.orderId);
    if (order) {
      order.status = "Failed";
      order.paymentStatus = "failed";
      await order.save();
    }
    res.status(500).json({
      success: false,
      redirect: `/orderFailure?message=${encodeURIComponent("Payment verification failed")}&orderId=${req.body.orderId || ""}&totalAmount=${order ? order.finalAmount : 0}`,
    });
  }
};

const getOrderFailurePage = async (req, res) => {
  try {
    const { message, orderId, totalAmount } = req.query;
    let order = null;

    if (orderId) {
      const foundOrder = await Order.findOne({ orderId }).lean();
      order = foundOrder ? { orderId: foundOrder.orderId, totalAmount: totalAmount || foundOrder.finalAmount } : { orderId, totalAmount: totalAmount || 0 };
    }

    res.render("orderFailure", {
      message: message || "An unknown error occurred",
      order: order || null,
      user: req.user,
    });
  } catch (error) {
    console.error("Error rendering order failure page:", error.stack);
    res.status(500).send("Internal Server Error");
  }
};

const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!req.user) {
      return res.status(401).json({ success: false, error: "User not authenticated" });
    }

    const order = await Order.findOne({ orderId, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (order.paymentMethod !== "razorpay" || !["failed", "pending"].includes(order.paymentStatus)) {
      return res.status(400).json({ success: false, error: "Payment retry not allowed for this order status" });
    }

    if (order.paymentStatus === "pending") {
      order.paymentStatus = "failed";
      order.status = "Failed";
      await order.save();
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: order.finalAmount * 100,
      currency: "INR",
      receipt: order.orderId,
    });

    order.razorpayOrderId = razorpayOrder.id;
    order.paymentAttempts = (order.paymentAttempts || 0) + 1;
    await order.save();

    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      razorpayOrderId: razorpayOrder.id,
      orderId: order._id,
    });
  } catch (error) {
    console.error("Error in retryPayment:", error);
    res.status(500).json({ success: false, error: "Server error: " + error.message });
  }
};

const verifyRetryPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;
    const crypto = require("crypto");

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: "Invalid payment signature" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    order.status = "Processing";
    await order.save();

    res.json({
      success: true,
      redirect: "/orderPlaced",
      order: {
        orderId: order.orderId,
        totalAmount: order.finalAmount,
        placedAt: order.createdOn,
      },
    });
  } catch (error) {
    console.error("Error verifying retry payment:", error);
    res.status(500).json({ success: false, error: "Payment verification failed" });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, subtotal } = req.body;
    const userId = req.user._id;

    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isListed: true,
      isDeleted: false,
      startOn: { $lte: new Date() },
      expireOn: { $gte: new Date() },
    });

    if (!coupon) {
      return res.json({ success: false, message: "Invalid or expired coupon" });
    }

    if (subtotal < coupon.minimumPrice) {
      return res.json({ success: false, message: `Minimum purchase of ₹${coupon.minimumPrice} required` });
    }

    if (coupon.usesCount >= coupon.maxUses) {
      return res.json({ success: false, message: "Coupon total usage limit reached" });
    }

    const userUse = coupon.userUses.find(use => use.userId.toString() === userId.toString());
    const userUsageCount = userUse ? userUse.count : 0;
    if (userUsageCount >= coupon.maxUsesPerUser) {
      return res.json({ success: false, message: "You have reached your usage limit for this coupon" });
    }

    res.json({ success: true, discount: coupon.offerPrice });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const paymentFailed = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    if (order.paymentMethod === "razorpay" && order.paymentStatus !== "success") {
      order.status = "Failed";
      order.paymentStatus = "failed";
      await order.save();
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating payment failure:", error.stack);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

module.exports = {
  getCartPage,
  getCheckoutPage,
  getCartDataForUser,
  placeOrder,
  verifyPayment,
  getOrderFailurePage,
  retryPayment,
  verifyRetryPayment,
  applyCoupon,
  paymentFailed,
}; 