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
const getCartPage = async (req, res) => {
    try {
        console.log("Session user:", req.session.user);
        const userId = getUserIdFromSession(req.session.user);

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            console.error("Invalid userId:", userId);
            return res.redirect("/pageNotFound");
        }

        const objectId = new mongoose.Types.ObjectId(userId);
        const user = await User.findById(objectId);
        if (!user) {
            console.error("User not found for ID:", userId);
            return res.redirect("/pageNotFound");
        }

        const cartData = await Cart.aggregate([
            { $match: { userId: objectId } },
            { $unwind: { path: "$products", preserveNullAndEmptyArrays: true } }, // Handle empty carts
            {
                $lookup: {
                    from: "products",
                    localField: "products.productId",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },
            // Filter out blocked products
            {
                $project: {
                    products: 1,
                    productDetails: {
                        $filter: {
                            input: "$productDetails",
                            cond: { $ne: ["$$this.isBlocked", true] },
                        },
                    },
                },
            },
            { $match: { "productDetails.0": { $exists: true } } }, // Ensure product exists
            {
                $lookup: {
                    from: "categories",
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails",
                },
            },
            // Filter listed categories
            {
                $project: {
                    products: 1,
                    productDetails: 1,
                    categoryDetails: {
                        $filter: {
                            input: "$categoryDetails",
                            cond: { $eq: ["$$this.isListed", true] },
                        },
                    },
                },
            },
            { $match: { "categoryDetails.0": { $exists: true } } }, // Ensure category exists
            {
                $lookup: {
                    from: "brands",
                    localField: "productDetails.brand",
                    foreignField: "_id",
                    as: "brandDetails",
                },
            },
            // Filter unblocked brands
            {
                $project: {
                    products: 1,
                    productDetails: 1,
                    categoryDetails: 1,
                    brandDetails: {
                        $filter: {
                            input: "$brandDetails",
                            cond: { $ne: ["$$this.isBlocked", true] },
                        },
                    },
                },
            },
            // Remove items where brandDetails is empty (i.e., brand is blocked)
            { $match: { "brandDetails.0": { $exists: true } } },
        ]);

        let grandTotal = 0;
        let totalQuantity = 0;

        if (cartData.length > 0) {
            cartData.forEach((item) => {
                if (item.productDetails && item.productDetails.length > 0) {
                    const price = item.productDetails[0].salesPrice || 0;
                    const quantity = item.products.quantity || 0;
                    grandTotal += price * quantity;
                    totalQuantity += quantity;
                }
            });
        }

        console.log("Cart Data:", JSON.stringify(cartData, null, 2));

        res.render("cart", {
            data: cartData,
            grandTotal,
            totalQuantity,
            user,
            cartData,
            userData: req.user,
        });
    } catch (error) {
        console.error("Error in getCartPage:", error);
        res.redirect("/pageNotFound");
    }
};

// Add to cart function
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

// Change product quantity in cart
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
        if (!product || quantity > product.quantity) {
            return res.status(404).json({ status: false, error: "Product not found or insufficient stock" });
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

// Delete product from cart
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