const mongoose = require('mongoose');
const Product = require('../../models/productSchema');
const Brand = require('../../models/brandSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');

const getUserData = async (userId) => {
    if (mongoose.Types.ObjectId.isValid(userId)) {
        return await User.findOne({ _id: new mongoose.Types.ObjectId(userId) });
    }
    console.log("Invalid user ID in session:", userId);
    return null;
};

const getFilters = (query) => {
    const filter = {
        isBlocked: false,
        status: "Available"
    };
    if (query.search) {
        const searchRegex = { $regex: query.search, $options: 'i' };
        filter.$or = [
            { productName: searchRegex },
            { 'category.name': searchRegex }, // Assumes category is populated
            { 'brand.brandName': searchRegex } // Assumes brand is populated
        ];
        // Search by price range if the search term is numeric
        const searchNum = parseFloat(query.search);
        if (!isNaN(searchNum)) {
            filter.salesPrice = { $gte: searchNum * 0.9, $lte: searchNum * 1.1 }; // ±10% range
        }
    }
    if (query.category && mongoose.Types.ObjectId.isValid(query.category)) {
        filter.category = new mongoose.Types.ObjectId(query.category);
    }
    if (query.brand && mongoose.Types.ObjectId.isValid(query.brand)) {
        filter.brand = new mongoose.Types.ObjectId(query.brand);
    }
    if (query.minPrice || query.maxPrice) {
        filter.salesPrice = filter.salesPrice || {};
        if (query.minPrice) filter.salesPrice.$gte = parseInt(query.minPrice);
        if (query.maxPrice) filter.salesPrice.$lte = parseInt(query.maxPrice);
    }
    return filter;
};

const getSortOptions = (sort) => {
    switch (sort) {
        case 'price-asc': return { salesPrice: 1 };
        case 'price-desc': return { salesPrice: -1 };
        case 'name-asc': return { productName: 1 };
        case 'name-desc': return { productName: -1 };
        default: return { createdAt: -1 };
    }
};

const calculateEffectivePrice = (product, currentDate) => {
    let effectivePrice = product.salesPrice;
    let offerPercentage = 0;
    let offerType = '';

    // Check product-specific offer
    if (product.productOffer > 0 && (!product.offerEndDate || product.offerEndDate > currentDate)) {
        effectivePrice = product.regularPrice * (1 - product.productOffer / 100);
        offerPercentage = product.productOffer;
        offerType = 'product';
    }

    // Check category offer if no product offer or if category offer is higher
    if (product.category?.categoryOffer > offerPercentage && (!product.category.offerEndDate || product.category.offerEndDate > currentDate)) {
        effectivePrice = product.regularPrice * (1 - product.category.categoryOffer / 100);
        offerPercentage = product.category.categoryOffer;
        offerType = 'category';
    }

    return {
        ...product._doc,
        effectivePrice: Math.round(effectivePrice),
        offerPercentage,
        offerType
    };
};

const loadShop = async (req, res, next) => {
    try {
        const userId = req.session.user;
        const userPromise = userId ? getUserData(userId) : Promise.resolve(null);

        const query = {
            search: req.query.search || '',
            sort: req.query.sort || '',
            category: req.query.category || '',
            brand: req.query.brand || '',
            maxPrice: req.query.maxPrice || '',
            minPrice: req.query.minPrice || ''
        };

        const brandsPromise = Brand.find({ isBlocked: false });
        const categoriesPromise = Category.find({ isListed: true });

        const [userData, brands, categories] = await Promise.all([userPromise, brandsPromise, categoriesPromise]);

        const brandIds = brands.map(brand => brand._id);
        const categoryIds = categories.map(category => category._id);

        const filter = getFilters(query);
        if (!query.brand) filter.brand = { $in: brandIds };
        if (!query.category) filter.category = { $in: categoryIds };

        const sortOptions = getSortOptions(query.sort);

        const productsData = await Product.find(filter)
            .populate('category')
            .populate('brand')
            .sort(sortOptions);

        const currentDate = new Date();
        const products = productsData.map(product => calculateEffectivePrice(product, currentDate));

        // Handle AJAX request for live search
        if (req.xhr) {
            return res.render('partials/product-grid', { products }); // No layout needed
        }

        res.render('shop', {
            products,
            categories,
            brands,
            query,
            userData,
            isLoggedIn: !!req.session.user
        });

    } catch (error) {
        console.error('Error in loadShop:', error);
        if (req.xhr) {
            return res.status(500).send('Error loading products');
        }
        next(error);
    }
};

module.exports = { loadShop };