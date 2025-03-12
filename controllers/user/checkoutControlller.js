const Address = require('../../models/addressSchema'); // Adjust the path as needed
const Cart = require('../../models/cartSchema'); // Adjust the path as needed
const Product = require('../../models/productSchema'); // Adjust the path as needed
const Category = require('../../models/categorySchema'); // Adjust the path as needed
const Brand = require('../../models/brandSchema'); // Adjust the path as needed
const Order = require('../../models/orderSchema');

const getCartPage = async (req, res) => {
  try {
    const cartData = await getCartDataForUser(req.user._id); // Use _id instead of id for consistency
    res.render('cart', { cartData, user: req.user });
  } catch (error) {
    console.error('Error fetching cart data:', error);
    res.status(500).send('Internal Server Error');
  }
};

const getCheckoutPage = async (req, res) => {
  try {
    const addressDoc = await Address.findOne({ userId: req.user._id }).lean();
    const addresses = addressDoc ? addressDoc.address : [];

    // Fetch cart data
    const cartItems = await getCartDataForUser(req.user._id);

    // Calculate subtotal and final amount
    const cartSubtotal = cartItems.reduce((sum, item) => {
      const salesPrice = item.productDetails?.salesPrice || 0;
      const quantity = item.quantity || 0;
      return sum + salesPrice * quantity;
    }, 0);
    const finalAmount = cartSubtotal; // Add any additional calculations if necessary

    res.render('checkout', { user: req.user, addresses, cartItems, cartSubtotal, finalAmount });
  } catch (error) {
    console.error('Error fetching address data:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Fetch cart data for user
async function getCartDataForUser(userId) {
  try {
    const cart = await Cart.findOne({ userId }).populate('products.productId').lean();
    if (!cart || !cart.products) {
      return [];
    }

    // Populate categoryDetails and brandDetails
    const populatedProducts = await Promise.all(cart.products.map(async (product) => {
      const productDetails = await Product.findById(product.productId).lean();
      const categoryDetails = await Category.findById(productDetails.category).lean();
      const brandDetails = await Brand.findById(productDetails.brand).lean();

      return {
        ...product,
        productDetails,
        categoryDetails,
        brandDetails
      };
    }));

    return populatedProducts;
  } catch (error) {
    console.error('Error fetching cart data for user:', error);
    return [];
  }
}

const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod } = req.body;
    const userId = req.user._id;

    // Fetch cart items
    const cartItems = await getCartDataForUser(userId);
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }

    // Calculate total
    const finalAmount = cartItems.reduce((sum, item) => {
      return sum + (item.productDetails.salesPrice * item.quantity);
    }, 0);

    // Create order
    const order = new Order({
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

    await order.save();

    // Clear the cart
    await Cart.updateOne(
      { userId: userId },
      { $set: { products: [] } }
    );

    res.json({ success: true, redirect: '/order-placed' });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ success: false, error: 'Failed to place order' });
  }
};

module.exports = {
  getCartPage,
  getCheckoutPage,
  getCartDataForUser,
  placeOrder
};