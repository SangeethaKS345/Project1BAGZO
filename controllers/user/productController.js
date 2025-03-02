const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const { ObjectId } = require("mongoose").Types;

<<<<<<< HEAD



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
=======
const productDetails = async (req, res, next) => {
    try {
        // Extract User ID
        const userId = req.session.user?._id;
        const productId = req.query.id;

        // Validate Product ID
        if (!productId || !ObjectId.isValid(productId)) {
            return res.redirect("/error");
        }

        // Fetch User Data
        const userData = userId ? await User.findById(userId) : null;
        console.log('User Data:', userData); // Add this line to log user data

        // Fetch Product Data
        const product = await Product.findById(productId)
            .populate("category")
            .populate("brand");
>>>>>>> 334f225 (cart page added. working on profile page.)

        if (!product) {
            console.log("Product not found");
            return res.redirect("/error");
        }

<<<<<<< HEAD
        // Get category and offer details
=======
        // Get Category & Offers
>>>>>>> 334f225 (cart page added. working on profile page.)
        const findCategory = product.category;
        const categoryOffer = Number(findCategory?.categoryOffer || 0);
        const productOffer = Number(product.productOffer || 0);
        const totalOffer = categoryOffer + productOffer;

<<<<<<< HEAD
        // Fetch related products (excluding the current one)
=======
        // Fetch Related Products (Exclude Current Product)
>>>>>>> 334f225 (cart page added. working on profile page.)
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
<<<<<<< HEAD

    } catch (error) {
        next(error); // Pass error to the error handler middleware
    }
};


module.exports = {
    productDetails,
};
=======

    } catch (error) {
        next(error);
    }
}; 

module.exports = { productDetails };
>>>>>>> 334f225 (cart page added. working on profile page.)
