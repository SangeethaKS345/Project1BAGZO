const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishListSchema");

const loadWishlistPage = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.redirect('/login');
        }
        
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const wishlist = await Wishlist.findOne({ userId: req.user._id })
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

const addToWishlist = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method Not Allowed. Please use POST.' 
        });
    }

    try {
        const productId = req.params.productId;
        const userId = req.user._id;

        // Validate if product exists
        const productExists = await Product.findById(productId);
        if (!productExists) {
            return res.status(404).json({ 
                success: false, 
                error: 'Product not found' 
            });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({
                userId,
                products: [{ productId }]
            });
        } else if (!wishlist.products.some(item => item.productId.toString() === productId)) {
            wishlist.products.push({ productId });
        } else {
            return res.json({ 
                success: false, 
                error: 'Product already in wishlist' 
            });
        }

        await wishlist.save();
        res.json({ 
            success: true,
            message: `Product "${productExists.name}" added to wishlist successfully` // Enhanced message
        });
    } catch (error) {
        console.error('Wishlist error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to add product to wishlist' 
        });
    }
};

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

const toggleWishlist = async (req, res) => {
    try {
      const productId = req.params.productId;
      const userId = req.user._id;
  
      // Validate product existence
      const productExists = await Product.findById(productId);
      if (!productExists) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }
  
      let wishlist = await Wishlist.findOne({ userId });
  
      if (!wishlist) {
        // Create new wishlist and add product
        wishlist = new Wishlist({
          userId,
          products: [{ productId }]
        });
        await wishlist.save();
        return res.json({
          success: true,
          message: `Product "${productExists.productName}" added to wishlist successfully`
        });
      }
  
      // Check if product is already in wishlist
      const productIndex = wishlist.products.findIndex(
        item => item.productId.toString() === productId
      );
  
      if (productIndex === -1) {
        // Product not in wishlist, add it
        wishlist.products.push({ productId });
        await wishlist.save();
        return res.json({
          success: true,
          message: `Product "${productExists.productName}" added to wishlist successfully`
        });
      } else {
        // Product in wishlist, remove it
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