const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishListSchema");

// Helper function to get a user's wishlist
const getWishlist = async (userId) => {
    return await Wishlist.findOne({ userId })
        .populate({
            path: 'products.productId',
            select: 'productName description productImage salesPrice status quantity combos isBlocked category brand',
            match: { 
                isBlocked: { $ne: true }
            },
            populate: [
                {
                    path: 'category',
                    select: 'isListed',
                    match: { isListed: true }
                },
                {
                    path: 'brand',
                    select: 'isBlocked',
                    match: { isBlocked: { $ne: true } }
                }
            ]
        });
};

// Load Wishlist Page
const loadWishlistPage = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.redirect('/login');
        }
        
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Fetch the wishlist and associated products in parallel
        const wishlist = await getWishlist(req.user._id);

        const wishlistItems = wishlist && wishlist.products.length > 0 
            ? wishlist.products.filter(item => 
                item.productId && 
                !item.productId.isBlocked && 
                item.productId.category && 
                item.productId.category.isListed && 
                item.productId.brand && 
                !item.productId.brand.isBlocked
            )
            : [];

        const totalItems = wishlistItems.length;
        const totalPages = Math.ceil(totalItems / limit);
        const paginatedItems = wishlistItems.slice(skip, skip + limit);

        res.render('wishlist', { 
            wishlistItems: paginatedItems,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.error('Error loading wishlist:', error);
        next(error);
    }
};

// Add Product to Wishlist
const addToWishlist = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method Not Allowed. Please use POST.' 
        });
    }

    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required. Please log in.'
        });
    }

    try {
        const productId = req.params.productId;
        const userId = req.user._id;

        // Fetch the product and wishlist in parallel using Promise.all
        const [productExists, wishlist] = await Promise.all([
            Product.findById(productId),
            Wishlist.findOne({ userId })
        ]);

        if (!productExists) {
            return res.status(404).json({ 
                success: false, 
                error: 'Product not found' 
            });
        }

        if (!wishlist) {
            const newWishlist = new Wishlist({
                userId,
                products: [{ productId }]
            });
            await newWishlist.save();
        } else if (!wishlist.products.some(item => item.productId.toString() === productId)) {
            wishlist.products.push({ productId });
            await wishlist.save();
        } else {
            return res.json({ 
                success: false, 
                error: 'Product already in wishlist' 
            });
        }

        res.json({ 
            success: true,
            message: `Product "${productExists.productName}" added to wishlist successfully`
        });
    } catch (error) {
        console.error('Wishlist error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to add product to wishlist' 
        });
    }
};

// Remove Product from Wishlist
const removeFromWishlist = async (req, res) => {
    try {
        const productId = req.params.productId;
        const userId = req.user._id;

        const wishlist = await Wishlist.findOne({ userId });
        
        if (!wishlist) {
            return res.status(404).json({ 
                success: false, 
                error: 'Wishlist not found' 
            });
        }

        wishlist.products = wishlist.products.filter(
            item => item.productId.toString() !== productId
        );

        await wishlist.save();
        res.json({ 
            success: true,
            message: 'Product removed from wishlist successfully'
        });
    } catch (error) {
        console.error('Wishlist error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to remove product from wishlist' 
        });
    }
};

// Check Wishlist Status
const checkWishlistStatus = async (req, res) => {
    try {
        const productId = req.query.productId;
        const userId = req.user._id;

        const wishlist = await Wishlist.findOne({ userId });
        
        const inWishlist = wishlist ? 
            wishlist.products.some(item => item.productId.toString() === productId) : 
            false;

        res.json({ 
            success: true,
            inWishlist 
        });
    } catch (error) {
        console.error('Wishlist status check error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to check wishlist status' 
        });
    }
};

// Toggle Wishlist Status
const toggleWishlist = async (req, res) => {
    try {
        const productId = req.params.productId;
        const userId = req.user._id;

        const [productExists, wishlist] = await Promise.all([
            Product.findById(productId),
            Wishlist.findOne({ userId })
        ]);

        if (!productExists) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        if (!wishlist) {
            const newWishlist = new Wishlist({
                userId,
                products: [{ productId }]
            });
            await newWishlist.save();
            return res.json({
                success: true,
                message: `Product "${productExists.productName}" added to wishlist successfully`
            });
        }

        const productIndex = wishlist.products.findIndex(
            item => item.productId.toString() === productId
        );

        if (productIndex === -1) {
            wishlist.products.push({ productId });
            await wishlist.save();
            return res.json({
                success: true,
                message: `Product "${productExists.productName}" added to wishlist successfully`
            });
        } else {
            wishlist.products.splice(productIndex, 1);
            await wishlist.save();
            return res.json({
                success: true,
                message: `Product "${productExists.productName}" removed from wishlist successfully`
            });
        }
    } catch (error) {
        console.error('Wishlist toggle error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update wishlist'
        });
    }
};

module.exports = {
    loadWishlistPage,
    addToWishlist,
    removeFromWishlist,
    checkWishlistStatus,
    toggleWishlist
};