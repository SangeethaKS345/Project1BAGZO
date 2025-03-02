const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");

// Missing function added
const getCartPage = async (req, res) => {
    try {
        let userId;
        if (typeof req.session.user === 'object' && req.session.user.id) {
            userId = req.session.user.id;
        } else {
            userId = req.session.user;
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.redirect("/pageNotFound");
        }

        const objectId = new mongoose.Types.ObjectId(userId);
        const user = await User.findById(objectId); // Fetch user details

        const cartData = await User.aggregate([
            { $match: { _id: objectId } },
            { $unwind: "$cart" },
            {
                $project: {
                    proId: { $toObjectId: "$cart.productId" },
                    quantity: "$cart.quantity",
                },
            },
            {
                $lookup: {
                    from: "products",
                    localField: "proId",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },
            { $unwind: "$productDetails" },
            {
                $group: {
                    _id: null,
                    products: { $push: { product: "$productDetails", quantity: "$quantity" } },
                    totalQuantity: { $sum: "$quantity" },
                    totalPrice: { $sum: { $multiply: ["$quantity", "$productDetails.salePrice"] } },
                },
            },
        ]);

        const data = cartData.length > 0 ? cartData[0].products : [];
        const totalPrice = cartData.length > 0 ? cartData[0].totalPrice : 0;
        const totalQuantity = cartData.length > 0 ? cartData[0].totalQuantity : 0;

        res.render("cart", { 
            data: data,
            grandTotal: totalPrice,
            totalQuantity: totalQuantity,
            user: user  // ✅ Pass the user object to the template
        });
    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound");
    }
};




async function addToCart(req, res) {
    try {
        console.log("Received data:", req.body);

        const { productId } = req.body;
        const userId = req.user._id; // Assuming authentication middleware sets this

        if (!productId) {
            return res.status(400).json({ message: "Product ID is required" });
        }

        // Validate productId format
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: "Invalid Product ID" });
        }

        const objectId = new mongoose.Types.ObjectId(productId);

        // Find the product details
        const product = await Product.findById(objectId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            cart = new Cart({ userId, products: [] });
        }

        const existingProduct = cart.products.find(item => item.productId.equals(objectId));

        if (existingProduct) {
            existingProduct.quantity += 1;
            existingProduct.totalPrice = existingProduct.quantity * product.salesPrice; // ✅ Update total price
        } else {
            cart.products.push({
                productId: objectId,
                quantity: 1,
                price: product.salesPrice, // ✅ Store price
                totalPrice: product.salesPrice // ✅ Initialize total price
            });
        }

        await cart.save();
        return res.status(200).json({ message: "Product added to cart successfully!" });

    } catch (error) {
        console.error("Error adding to cart:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}


const changeQuantity = async (req, res) => {
  try {
    const productId = req.body.productId;
    const newQuantity = parseInt(req.body.quantity); // Added missing definition
    
    // Extract user ID properly
    let userId;
    if (typeof req.session.user === 'object' && req.session.user.id) {
      userId = req.session.user.id;
    } else {
      userId = req.session.user;
    }
    
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({ status: false, error: "Invalid ID" });
    }
    
    // Find the product to check stock and calculate price
    const findProduct = await Product.findById(productId);
    if (!findProduct) {
      return res.json({ status: false, error: "Product not found" });
    }
    
    if (newQuantity > 0 && newQuantity <= findProduct.quantity) {
      let quantityUpdated = await User.updateOne(
        { 
          _id: new mongoose.Types.ObjectId(userId), 
          "cart.productId": new mongoose.Types.ObjectId(productId) 
        },
        {
          $set: {
            "cart.$.quantity": newQuantity,
          },
        }
      );
      
      const totalAmount = findProduct.salePrice * newQuantity;
      const objectId = new mongoose.Types.ObjectId(userId);
      
      const grandTotal = await User.aggregate([
        { $match: { _id: objectId } },
        { $unwind: "$cart" },
        {
          $project: {
            proId: { $toObjectId: "$cart.productId" },
            quantity: "$cart.quantity",
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "proId",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        {
          $unwind: "$productDetails",
        },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: "$quantity" },
            totalPrice: {
              $sum: { $multiply: ["$quantity", "$productDetails.salePrice"] },
            }, 
          },
        },
      ]);
      
      if (quantityUpdated && grandTotal && grandTotal.length > 0) {
        res.json({
          status: true,
          quantityInput: newQuantity,
          count: grandTotal[0].totalQuantity, // Fixed the undefined count variable
          totalAmount: totalAmount,
          grandTotal: grandTotal[0].totalPrice,
        });
      } else {
        res.json({ status: false, error: "Failed to update quantity" });
      }
    } else {
      res.json({ status: false, error: "Invalid quantity" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: "Server error" });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = req.query.id;
    
    // Extract user ID properly
    let userId;
    if (typeof req.session.user === 'object' && req.session.user.id) {
      userId = req.session.user.id;
    } else {
      userId = req.session.user;
    }
    
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.redirect("/pageNotFound");
    }
    
    // Convert string IDs to ObjectIds
    const objectId = new mongoose.Types.ObjectId(userId);
    const productObjectId = new mongoose.Types.ObjectId(productId);
    
    // Remove product from cart
    await User.updateOne(
      { _id: objectId },
      { $pull: { cart: { productId: productObjectId } } }
    );
    
    res.redirect("/cart");
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  getCartPage,
  addToCart,
  changeQuantity,
  deleteProduct,
};