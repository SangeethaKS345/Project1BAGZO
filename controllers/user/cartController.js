const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishListSchema");

// Get Cart Page with data
const getCartPage = async (req, res) => {
    try {
        console.log("Session user:", req.session.user);
  
        let userId;
        if (typeof req.session.user === 'string') {
            userId = req.session.user;
        } else if (typeof req.session.user === 'object' && req.session.user.id) {
            userId = req.session.user.id;
        } else if (typeof req.session.user === 'object' && req.session.user._id) {
            userId = req.session.user._id;
        } else {
            console.error("Invalid session user format:", req.session.user);
            return res.redirect("/login");
        }
  
        if (!mongoose.Types.ObjectId.isValid(userId)) {
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
            { $unwind: { path: "$products", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "products",
                    localField: "products.productId",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },
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
            { $match: { "productDetails.0": { $exists: true } } },
            {
                $lookup: {
                    from: "categories",
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails",
                },
            },
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
            { $match: { "categoryDetails.0": { $exists: true } } },
            {
                $lookup: {
                    from: "brands",
                    localField: "productDetails.brand",
                    foreignField: "_id",
                    as: "brandDetails",
                },
            },
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
            { $match: { "brandDetails.0": { $exists: true } } },
        ]);

        // Calculate effective price for each cart item
        const currentDate = new Date();
        const processedCartData = cartData.map(item => {
            const product = item.productDetails[0];
            let effectivePrice = product.salesPrice;
            let offerPercentage = 0;
            let offerType = '';

            // Check product-specific offer
            if (product.productOffer > 0 && 
                (!product.offerEndDate || product.offerEndDate > currentDate)) {
                effectivePrice = product.regularPrice * (1 - product.productOffer/100);
                offerPercentage = product.productOffer;
                offerType = 'product';
            }
            
            // Check category offer if no product offer or if category offer is higher
            const category = item.categoryDetails[0];
            if (category?.categoryOffer > offerPercentage && 
                (!category.offerEndDate || category.offerEndDate > currentDate)) {
                effectivePrice = product.regularPrice * (1 - category.categoryOffer/100);
                offerPercentage = category.categoryOffer;
                offerType = 'category';
            }

            return {
                ...item,
                effectivePrice: Math.round(effectivePrice),
                offerPercentage,
                offerType
            };
        });

        let grandTotal = 0;
        let totalQuantity = 0;

        if (processedCartData.length > 0) {
            processedCartData.forEach((item) => {
                if (item.productDetails && item.productDetails.length > 0) {
                    grandTotal += item.effectivePrice * item.products.quantity;
                    totalQuantity += item.products.quantity;
                }
            });
        }

        console.log("Processed Cart Data:", JSON.stringify(processedCartData, null, 2));

        res.render("cart", {
            data: processedCartData,
            grandTotal: grandTotal,
            totalQuantity: totalQuantity,
            user: user,
            cartData: processedCartData,
            userData: req.user,
        });
    } catch (error) {
        console.error("Error in getCartPage:", error);
        res.redirect("/pageNotFound");
    }
};

// Add to cart function
async function addToCart(req, res) {
    try {
        console.log("Received data:", req.body);
        console.log("Session data:", req.session);

        const { productId, quantity = 1 } = req.body; // Default quantity to 1 if not provided

        // Check if user is logged in
        if (!req.session || !req.session.user) {
            return res.status(401).json({ message: "Please log in to add items to your cart" });
        }

        // Extract userId from session
        let userId;
        if (typeof req.session.user === "object" && req.session.user.id) {
            userId = req.session.user.id;
        } else if (typeof req.session.user === "object" && req.session.user._id) {
            userId = req.session.user._id;
        } else if (typeof req.session.user === "string") {
            userId = req.session.user;
        } else {
            return res.status(401).json({ message: "Invalid session data. Please log in again." });
        }

        // Validate productId
        if (!productId) {
            return res.status(400).json({ message: "Product ID is required" });
        }
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: "Invalid Product ID" });
        }

        const productObjectId = new mongoose.Types.ObjectId(productId);
        const userObjectId = new mongoose.Types.ObjectId(userId);

        // Fetch product with populated category and brand
        const product = await Product.findById(productObjectId)
            .populate("category")
            .populate("brand");

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Check product availability
        if (product.isBlocked) {
            return res.status(400).json({ message: "This product is blocked and not available" });
        }
        if (product.status === "out of stock") {
            return res.status(400).json({ message: "This product is out of stock" });
        }
        if (product.quantity <= 0) {
            return res.status(400).json({ message: "This product is out of stock" });
        }
        if (quantity > product.quantity) {
            return res.status(400).json({ message: "Requested quantity exceeds available stock" });
        }

        // Check category status
        if (!product.category || product.category.isListed === false) {
            return res.status(400).json({ message: "This product's category is unlisted" });
        }

        // Check brand status
        if (!product.brand || product.brand.isBlocked) {
            return res.status(400).json({ message: "This product's brand is blocked" });
        }

        // Fetch or create cart
        let cart = await Cart.findOne({ userId: userObjectId });
        if (!cart) {
            cart = new Cart({ userId: userObjectId, products: [] });
        }

        // Check cart product limit
        if (
            cart.products.length >= 4 &&
            !cart.products.some((item) => item.productId.equals(productObjectId))
        ) {
            return res.status(400).json({ message: "Cart cannot contain more than 4 different products" });
        }

        // Update or add product to cart
        const existingProduct = cart.products.find((item) =>
            item.productId.equals(productObjectId)
        );
        if (existingProduct) {
            const newQuantity = existingProduct.quantity + parseInt(quantity);
            if (newQuantity > product.quantity) {
                return res.status(400).json({
                    message: "Cannot add more of this product. Maximum stock limit reached.",
                });
            }
            if (newQuantity > 5) {
                return res.status(400).json({
                    message: "Cannot add more of this product. Maximum limit of 5 per product reached.",
                });
            }
            existingProduct.quantity = newQuantity;
            existingProduct.totalPrice = existingProduct.quantity * existingProduct.price;
        } else {
            const currentDate = new Date();
            let effectivePrice = product.salesPrice;
            let offerPercentage = 0;

            if (product.productOffer > 0 && 
                (!product.offerEndDate || product.offerEndDate > currentDate)) {
                effectivePrice = product.regularPrice * (1 - product.productOffer/100);
                offerPercentage = product.productOffer;
            }
            
            if (product.category?.categoryOffer > offerPercentage && 
                (!product.category.offerEndDate || product.category.offerEndDate > currentDate)) {
                effectivePrice = product.regularPrice * (1 - product.category.categoryOffer/100);
                offerPercentage = product.category.categoryOffer;
            }

            effectivePrice = Math.round(effectivePrice);
            
            cart.products.push({
                productId: productObjectId,
                quantity: parseInt(quantity),
                price: effectivePrice,
                totalPrice: effectivePrice * quantity,
            });
        }

        // Save cart
        await cart.save();

        // Remove from wishlist after successful cart addition
        await Wishlist.updateOne(
            { userId: userObjectId },
            { $pull: { products: { productId: productObjectId } } }
        );

        return res.status(200).json({ message: "Product added to cart successfully!" });
    } catch (error) {
        console.error("Error adding to cart:", error.stack);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}

// Change product quantity in cart
const changeQuantity = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        console.log('Received changeQuantity request:', { productId, quantity });

        let userId;
        if (typeof req.session.user === 'object' && req.session.user.id) {
            userId = req.session.user.id;
        } else {
            userId = req.session.user;
        }

        if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ status: false, error: "Invalid ID format" });
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);
        const productObjectId = new mongoose.Types.ObjectId(productId);

        const product = await Product.findById(productObjectId).populate('category');
        if (!product) {
            return res.status(404).json({ status: false, error: "Product not found" });
        }

        if (quantity > product.quantity) {
            return res.status(400).json({ status: false, error: `Only ${product.quantity} items available in stock` });
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
        productInCart.totalPrice = productInCart.quantity * productInCart.price;

        await cart.save();

        let grandTotal = 0;
        cart.products.forEach(item => {
            grandTotal += item.totalPrice;
        });

        console.log('Returning response:', {
            status: true,
            quantityInput: productInCart.quantity,
            totalAmount: productInCart.totalPrice,
            grandTotal: grandTotal
        });

        res.json({
            status: true,
            quantityInput: productInCart.quantity,
            totalAmount: productInCart.totalPrice,
            grandTotal: grandTotal
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
        
        let userId;
        if (typeof req.session.user === 'object' && req.session.user.id) {
            userId = req.session.user.id;
        } else {
            userId = req.session.user;
        }
        
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

        let grandTotal = 0;
        let totalQuantity = 0;

        if (cart && cart.products.length > 0) {
            for (const item of cart.products) {
                const prod = await Product.findById(item.productId);
                grandTotal += item.quantity * prod.salesPrice;
                totalQuantity += item.quantity;
            }
        }

        res.json({
            status: true,
            grandTotal: grandTotal,
            totalQuantity: totalQuantity
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