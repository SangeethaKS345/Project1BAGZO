const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema")





// const productDetails = async (req,res)=>{
//   try {
//     console.log("product page");
    
//    const userId = req.session.user;
//    const userData = await User.findOne({_id:userId});
//    const productId = req.query.id;
//    const product = await Product.findOne({_id:productId}).populate('category');
//    const findCategory = product.category;
//    const categoryOffer = findCategory ?.categoryOffer || 0;
//    const productOffer = product.productOffer || 0;
//    const totalOffer = categoryOffer + productOffer ;
//    console.log(product)
//    res.render("product-details" ,{
//     user : userData,
//      product:product,
//      quantity:product.quantity,
//      totalOffer:totalOffer,
//      category:findCategory,

//    });
     
//   } catch (error) {
     
//     console.error("Error for fetching details",error);
//     res.redirect("/pageNotFound")

//   }
// };

// // const productDetails = async (req, res) => {
// //   try {
// //       const userId = req.session.user
// //       const productId = req.query.id

// //       const product = await Product.findOne({ _id: productId,isListed:true }).populate('category').populate('brand')
// //       console.log(product, 'product')

// //       if(!product){
// //           return res.status(400).json({success:false , message :"Product not found "})
// //       }

// //       const findCategory = product.category

// //       const findBrand = product.brand


//       const relatedProducts = await Product.find({ category: findCategory._id, _id: { $ne: productId } }).limit(3)

//       if (userId) {
//           if (product && product.isListed===true) {

//               const user = await User.findById({ _id: userId })
//               res.render('productdetails', {
//                   user: user,
//                   product: product,
//                   quantity: product.quantity,
//                   category: findCategory,
//                   brand: findBrand,
//                   relatedProducts: relatedProducts
//               })
//           }
//       } else {
//           res.render('productdetails', {
//               product: product,
//               quantity: product.quantity,
//               category: findCategory,
//               brand: findBrand,
//               relatedProducts: relatedProducts
//           })
//       }
//   } catch (error) {
//       console.error(error)
//       res.status(500).json("sercer error")
//   }



// module.exports = {
//    productDetails,
// }





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
            return res.redirect("/404");
        }

        // Get category and offer details
        const findCategory = product.category;
        const categoryOffer = findCategory?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;
        const totalOffer = categoryOffer + productOffer;

        // Fetch related products (excluding the current one)
        const relatedProducts = await Product.find({ 
            category: findCategory?._id, 
            _id: { $ne: productId } 
        }).limit(3);

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
