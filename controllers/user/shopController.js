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
            { 'category.name': searchRegex },
            { 'brand.brandName': searchRegex }
        ];
        const searchNum = parseFloat(query.search);
        if (!isNaN(searchNum)) {
            filter.salesPrice = { $gte: searchNum * 0.9, $lte: searchNum * 1.1 };
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

const calculatePriceDetails = (product) => {
    const categoryOffer = Number(product.category?.categoryOffer || 0);
    const productOffer = Number(product.productOffer || 0);
    const offerPercentage = Math.max(categoryOffer, productOffer);
    const effectivePrice = Math.round(product.salesPrice - (product.salesPrice * (offerPercentage / 100)));
    
    console.log(`Product: ${product.productName}`);
    console.log(`Category Offer: ${categoryOffer}, Product Offer: ${productOffer}`);
    console.log(`Max Offer: ${offerPercentage}, Effective Price: ${effectivePrice}`);

    const discountPercentage = offerPercentage > 0 
        ? offerPercentage 
        : Math.round(((product.regularPrice - product.salesPrice) / product.regularPrice) * 100);

    return {
        ...product._doc,
        effectivePrice,
        offerPercentage,
        discountPercentage
    };
};

const loadShop = async (req, res, next) => {
    try {
        const userId = req.session.user;
        const userPromise = userId ? getUserData(userId) : Promise.resolve(null);

        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        const query = {
            search: req.query.search || '',
            sort: req.query.sort || '',
            category: req.query.category || '',
            brand: req.query.brand || '',
            maxPrice: req.query.maxPrice || '',
            minPrice: req.query.minPrice || '',
            page: page
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
        const totalProducts = await Product.countDocuments(filter);

        const productsData = await Product.find(filter)
            .populate('category')
            .populate('brand')
            .sort(sortOptions)
            .skip(skip)
            .limit(limit);

        const products = productsData.map(product => calculatePriceDetails(product));

        if (req.xhr) {
            return res.render('partials/product-grid', { 
                products,
                totalProducts,
                query 
            });
        }

        res.render('shop', {
            products,
            categories,
            brands,
            query,
            userData,
            isLoggedIn: !!req.session.user,
            totalProducts
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