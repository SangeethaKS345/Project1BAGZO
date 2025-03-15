const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const Order = require('../../models/orderSchema');

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
      req.session.error = "Your cart is empty. Add items before checking out.";
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
      console.log("Missing addressId or paymentMethod");
      return res.status(400).json({ success: false, error: 'Address and payment method are required' });
    }

    // Fetch cart items
    const cartItems = await getCartDataForUser(userId);
    console.log("Cart Items:", cartItems);
    if (!cartItems || cartItems.length === 0) {
      console.log("Cart is empty");
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }

    // Verify all items have valid productDetails
    const invalidItems = cartItems.filter(item => !item.productDetails || !item.productDetails._id);
    if (invalidItems.length > 0) {
      console.log("Invalid cart items found:", invalidItems);
      return res.status(400).json({ 
        success: false, 
        error: 'Cart contains invalid or missing product data' 
      });
    }

    // Check quantity limits
    const exceedsLimit = cartItems.some(item => item.quantity > 5);
    if (exceedsLimit) {
      console.log("Quantity limit exceeded");
      return res.status(400).json({ 
        success: false, 
        error: 'Quantity limit exceeded. Maximum 5 items per product allowed.' 
      });
    }

    // Calculate total
    const finalAmount = cartItems.reduce((sum, item) => {
      const price = item.productDetails?.salesPrice || 0;
      console.log(`Item: ${item.productDetails?.productName}, Price: ${price}, Qty: ${item.quantity}`);
      return sum + (price * item.quantity);
    }, 0);
    console.log("Calculated Final Amount:", finalAmount);

    // Validate selected address
    const selectedAddress = await Address.findById(addressId).lean();
    if (!selectedAddress || selectedAddress.userId.toString() !== userId.toString()) {
      console.log("Invalid address selected:", addressId);
      return res.status(400).json({ success: false, error: 'Invalid address selected' });
    }
    console.log("Selected Address:", selectedAddress);

    // Create order
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
      status: 'Pending',
      paymentMethod: paymentMethod
    });

    console.log("Order to Save:", order.toObject());
    await order.save();
    console.log("Order Saved Successfully");

    // Clear the cart
    const cartUpdateResult = await Cart.updateOne(
      { userId: userId },
      { $set: { products: [] } }
    );
    console.log("Cart Update Result:", cartUpdateResult);

    res.json({ success: true, redirect: '/orderPlaced' });
  } catch (error) {
    console.error('Error placing order:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to place order due to a server error' 
    });
  }
};

module.exports = {
  getCartPage,
  getCheckoutPage,
  getCartDataForUser,
  placeOrder
};

