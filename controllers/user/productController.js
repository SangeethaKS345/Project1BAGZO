const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Brand = require("../../models/brandSchema");
const { ObjectId } = require("mongoose").Types;

const productDetails = async (req, res, next) => {
    try {
        // Extract user ID correctly
        const userId = req.session.user?.id;
        const productId = req.query.id;

        if (!productId) {
            return res.redirect("/404");
        }

        // Fetch user data if logged in
        const userData = userId ? await User.findById(userId) : null;
        
        // Fetch product data
        const product = await Product.findById(productId)
            .populate('category')
            .populate('brand');

        if (!product) {
            console.log("Product not found");
            return res.redirect("/error");
        }

        // Get category and offer details
        const findCategory = product.category;
        const categoryOffer = Number(findCategory?.categoryOffer || 0);
        const productOffer = Number(product.productOffer || 0);
        const totalOffer = categoryOffer + productOffer;

        // Fetch related products (excluding the current one)
        const relatedProducts = await Product.find({ 
            category: findCategory?._id, 
            _id: { $ne: productId } 
        }).limit(3);

        // Render Product Details Page
        res.render("productDetails", {
            userData,
            product,
            quantity: product.quantity,
            category: findCategory,
            relatedProducts,
            totalOffer
        });

    } catch (error) {
        next(error); // Pass error to the error handler middleware
    }
};


module.exports = {
    productDetails,
};
