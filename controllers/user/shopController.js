const mongoose = require('mongoose');
const Product = require('../../models/productSchema');
const Brand = require('../../models/brandSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema')

const loadShop = async (req, res, next) => {
    try {
        let userData = null;

        if (req.session.user) {
            if (mongoose.Types.ObjectId.isValid(req.session.user)) {
                userData = await User.findOne({ _id: new mongoose.Types.ObjectId(req.session.user) });
            } else {
                console.log("Invalid user ID in session:", req.session.user);
            }
        }

        const query = {
            search: req.query.search || '',
            sort: req.query.sort || '',
            category: req.query.category || '',
            brand: req.query.brand || '',
            maxPrice: req.query.maxPrice || '',
            minPrice: req.query.minPrice || ''
        };

        const brands = await Brand.find({ isBlocked: false });
        const categories = await Category.find({ isListed: true });

        const brandIds = brands.map(brand => brand._id);
        const categoryIds = categories.map(category => category._id);

        const filter = {
            isBlocked: false,
            status: "Available",
            brand: { $in: brandIds },
            category: { $in: categoryIds }
        };

        if (query.search) {
            filter.productName = { $regex: query.search, $options: 'i' };
        }
        if (query.category) filter.category = query.category;
        if (query.brand) filter.brand = query.brand;
        if (query.minPrice || query.maxPrice) {
            filter.salesPrice = {};
            if (query.minPrice) filter.salesPrice.$gte = parseInt(query.minPrice);
            if (query.maxPrice) filter.salesPrice.$lte = parseInt(query.maxPrice);
        }

        let sortOptions = {};
        switch (query.sort) {
            case 'price-asc': sortOptions = { salesPrice: 1 }; break;
            case 'price-desc': sortOptions = { salesPrice: -1 }; break;
            case 'name-asc': sortOptions = { productName: 1 }; break;
            case 'name-desc': sortOptions = { productName: -1 }; break;
            default: sortOptions = { createdAt: -1 };
        }

        const products = await Product.find(filter).sort(sortOptions).populate('category').populate('brand');

        console.log('Products:', products);

        res.render('shop', {
            products,
            categories,
            brands,
            query,
            userData,
            isLoggedIn: !!req.session.user
        });

    } catch (error) {
        next(error);
    }
};

module.exports = { loadShop };
