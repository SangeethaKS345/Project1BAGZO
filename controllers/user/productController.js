const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const { ObjectId } = require("mongoose").Types;

// Load Product Details Page
const productDetails = async (req, res, next) => {
    try {
        const userId = req.session.user?.id;
        const productId = req.query.id;

        if (!ObjectId.isValid(productId)) {
            return res.redirect("/404");
        }

        const [userData, product] = await Promise.all([
            userId ? User.findById(userId) : null,
            Product.findById(productId).populate('category brand')
        ]);

        if (!product) {
            return res.redirect("/error");
        }

        // Calculate offers
        const categoryOffer = Number(product.category?.categoryOffer || 0);
        const productOffer = Number(product.productOffer || 0);
        
        // Take the highest offer if both exist, but only if at least one is > 0
        const maxOffer = Math.max(categoryOffer, productOffer);
        let finalPrice = product.salesPrice;
        let discountPercentage = 0;

        // Apply offer only if maxOffer is greater than 0
        if (maxOffer > 0) {
            finalPrice = product.salesPrice - (product.salesPrice * (maxOffer / 100));
            discountPercentage = maxOffer;
        }

        const relatedProducts = await Product.find({
            category: product.category?._id,
            _id: { $ne: productId }
        }).limit(3);

        res.render("productDetails", {
            userData,
            product,
            quantity: product.quantity,
            category: product.category,
            relatedProducts,
            finalPrice,
            maxOffer,
            discountPercentage
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    productDetails,
};