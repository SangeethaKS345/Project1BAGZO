const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishListSchema");

const getUserIdFromSession = (sessionUser) => {
    if (typeof sessionUser === 'string') return sessionUser;
    if (typeof sessionUser === 'object') return sessionUser.id || sessionUser._id;
    return null;
};

// Get Cart Page with data
const getCartPage = async (req, res, next) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) {
            return res.redirect("/signin");
        }

        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'products.productId',
                model: 'Product',
                populate: [
                    { path: 'category', model: 'Category' },
                    { path: 'brand', model: 'Brand' }
                ]
            });

        if (!cart) {
            return res.render("cart", {
                userData: await User.findById(userId),
                cartData: []
            });
        }

        // Process cart data with new pricing logic
        const cartData = await Promise.all(cart.products.map(async (item) => {
            const product = item.productId;
            const quantity = item.quantity;
            const regularPrice = product.regularPrice || 0;
            const salesPrice = product.salesPrice || regularPrice;
            const productOffer = product.productOffer || 0;
            const categoryOffer = product.category?.categoryOffer || 0;

            let finalPrice = regularPrice;
            let discount = 0;

            // Case 1: No offer and prices equal
            if (productOffer === 0 && categoryOffer === 0 && salesPrice === regularPrice) {
                finalPrice = regularPrice;
                discount = 0;
            }
            // Case 2: No offer and prices not equal
            else if (productOffer === 0 && categoryOffer === 0 && salesPrice !== regularPrice) {
                finalPrice = salesPrice;
                discount = regularPrice - salesPrice;
            }
            // Case 3 & 4: Has offer(s)
            else if (productOffer > 0 || categoryOffer > 0) {
                const offer = Math.max(productOffer, categoryOffer); // Take highest offer
                const offerDiscount = salesPrice * (offer / 100);
                finalPrice = salesPrice - offerDiscount;
                discount = regularPrice - finalPrice;
            }

            return {
                products: { quantity },
                productDetails: [{
                    _id: product._id,
                    productName: product.productName,
                    regularPrice,
                    salesPrice,
                    productOffer,
                    productImage: product.productImage,
                    maxQuantity: product.quantity,
                    isOnSale: (productOffer > 0 || categoryOffer > 0 || salesPrice < regularPrice)
                }],
                categoryDetails: [{ 
                    name: product.category?.name || 'Unknown',
                    categoryOffer 
                }],
                brandDetails: [{ brandName: product.brand?.brandName || 'Unknown' }],
                finalPrice,
                discount
            };
        }));

        res.render("cart", {
            userData: await User.findById(userId),
            cartData
        });

    } catch (error) {
        next(error);
    }
};

// Add to cart function (unchanged)
const addToCart = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        const userId = getUserIdFromSession(req.session.user);

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please log in to add items to your cart" });
        }

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: "Invalid Product ID" });
        }

        const productObjectId = new mongoose.Types.ObjectId(productId);
        const userObjectId = new mongoose.Types.ObjectId(userId);

        const product = await Product.findById(productObjectId).populate("category").populate("brand");
        if (!product || product.isBlocked || product.status === "out of stock" || product.quantity <= 0) {
            return res.status(404).json({ success: false, message: "Product not found or unavailable" });
        }

        if (quantity > product.quantity) {
            return res.status(400).json({ success: false, message: "Requested quantity exceeds available stock" });
        }

        if (!product.category?.isListed || product.brand?.isBlocked) {
            return res.status(400).json({ success: false, message: "Product's category or brand is unavailable" });
        }

        let cart = await Cart.findOne({ userId: userObjectId }) || new Cart({ userId: userObjectId, products: [] });

        if (cart.products.length >= 4 && !cart.products.some(item => item.productId.equals(productObjectId))) {
            return res.status(400).json({ success: false, message: "Cart cannot contain more than 4 different products" });
        }

        const existingProduct = cart.products.find(item => item.productId.equals(productObjectId));
        if (existingProduct) {
            const newQuantity = existingProduct.quantity + parseInt(quantity);
            if (newQuantity > product.quantity || newQuantity > 5) {
                return res.status(400).json({ success: false, message: "Cannot add more of this product. Maximum limit reached." });
            }
            existingProduct.quantity = newQuantity;
            existingProduct.totalPrice = newQuantity * product.salesPrice;
        } else {
            cart.products.push({
                productId: productObjectId,
                quantity: parseInt(quantity),
                price: product.salesPrice,
                totalPrice: product.salesPrice * quantity,
            });
        }

        await cart.save();
        await Wishlist.updateOne({ userId: userObjectId }, { $pull: { products: { productId: productObjectId } } });

        return res.status(200).json({ success: true, message: "Product added to cart successfully!" });
    } catch (error) {
        console.error("Error adding to cart:", error.stack);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};

// Change product quantity in cart (unchanged)
const changeQuantity = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = getUserIdFromSession(req.session.user);

        if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ status: false, error: "Invalid ID format" });
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);
        const productObjectId = new mongoose.Types.ObjectId(productId);

        const product = await Product.findById(productObjectId);
        if (!product || product.quantity <= 0 || product.status === "out of stock") {
            // Remove from cart if out of stock
            await Cart.updateOne(
                { userId: userObjectId },
                { $pull: { products: { productId: productObjectId } } }
            );
            return res.status(404).json({ status: false, error: "Product is out of stock and has been removed from your cart" });
        }
        if (quantity > product.quantity) {
            return res.status(400).json({ status: false, error: "Insufficient stock" });
        }

        const cart = await Cart.findOne({ userId: userObjectId });
        if (!cart) {
            return res.status(404).json({ status: false, error: "Cart not found" });
        }

        const productInCart = cart.products.find(item => item.productId.equals(productObjectId));
        if (!productInCart) {
            return res.status(404).json({ status: false, error: "Product not in cart" });
        }

        productInCart.quantity = parseInt(quantity);
        productInCart.totalPrice = productInCart.quantity * product.salesPrice;
        await cart.save();

        const grandTotal = cart.products.reduce((acc, item) => acc + item.totalPrice, 0);

        res.json({
            status: true,
            quantityInput: productInCart.quantity,
            totalAmount: productInCart.totalPrice,
            grandTotal,
        });
    } catch (error) {
        console.error("Error in changeQuantity:", error);
        res.status(500).json({ status: false, error: "Server error" });
    }
};

// Delete product from cart (unchanged)
const deleteProduct = async (req, res) => {
    try {
        const productId = req.query.id;
        const userId = getUserIdFromSession(req.session.user);

        if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.redirect("/pageNotFound");
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);
        const productObjectId = new mongoose.Types.ObjectId(productId);

        await Cart.updateOne(
            { userId: userObjectId },
            { $pull: { products: { productId: productObjectId } } }
        );

        const cart = await Cart.findOne({ userId: userObjectId });

        const { grandTotal, totalQuantity } = await cart.products.reduce(async (accPromise, item) => {
            const acc = await accPromise;
            const prod = await Product.findById(item.productId);
            acc.grandTotal += item.quantity * prod.salesPrice;
            acc.totalQuantity += item.quantity;
            return acc;
        }, Promise.resolve({ grandTotal: 0, totalQuantity: 0 }));

        res.json({
            status: true,
            grandTotal,
            totalQuantity,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, error: "Server error" });
    }
};

module.exports = {
    getCartPage,
    addToCart,
    changeQuantity,
    deleteProduct,
};