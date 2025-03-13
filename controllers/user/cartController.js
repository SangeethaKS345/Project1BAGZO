const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");

// Get Cart Page with data
const getCartPage = async (req, res) => {
  try {
    // Log the session user to debug
    console.log("Session user:", req.session.user);

    let userId;
    // Handle different possible formats of req.session.user
    if (typeof req.session.user === 'string') {
      userId = req.session.user; // If it's just the ID as a string
    } else if (typeof req.session.user === 'object' && req.session.user.id) {
      userId = req.session.user.id; // If it's an object with an 'id' field
    } else if (typeof req.session.user === 'object' && req.session.user._id) {
      userId = req.session.user._id; // If it's an object with an '_id' field
    } else {
      console.error("Invalid session user format:", req.session.user);
      return res.redirect("/login"); // Redirect to login if user session is invalid
    }

    // Validate the userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error("Invalid userId:", userId);
      return res.redirect("/pageNotFound");
    }

    const objectId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(objectId);
    if (!user) {
      console.error("User not found for ID:", userId);
      return res.redirect("/pageNotFound");
    }

    const cartData = await Cart.aggregate([
      { $match: { userId: objectId } },
      { $unwind: "$products" },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "productDetails.category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      {
        $lookup: {
          from: "brands",
          localField: "productDetails.brand",
          foreignField: "_id",
          as: "brandDetails",
        },
      },
    ]);

    let grandTotal = 0;
    let totalQuantity = 0;

    if (cartData.length > 0) {
      cartData.forEach((item) => {
        const price = item.productDetails[0].salesPrice;
        const quantity = item.products.quantity;
        grandTotal += price * quantity;
        totalQuantity += quantity;
      });
    }

    res.render("cart", {
      data: cartData,
      grandTotal: grandTotal,
      totalQuantity: totalQuantity,
      user: user,
      cartData,
      userData: req.user, // Pass userData to the template
    });
  } catch (error) {
    console.error("Error in getCartPage:", error);
    res.redirect("/pageNotFound");
  }
};

// Add to cart function
async function addToCart(req, res) {
    try {
        console.log("Received data:", req.body);
        console.log("Session data:", req.session); // Debug log

        const { productId } = req.body;

        // Check if user is authenticated
        if (!req.session || !req.session.user) {
            console.log("No session or user found"); // Debug log
            return res.status(401).json({ message: "Please log in to add items to your cart" });
        }

        let userId;
        if (typeof req.session.user === 'object' && req.session.user.id) {
            userId = req.session.user.id;
        } else if (typeof req.session.user === 'object' && req.session.user._id) {
            userId = req.session.user._id;
        } else if (typeof req.session.user === 'string') {
            userId = req.session.user;
        } else {
            console.log("Invalid session user format:", req.session.user); // Debug log
            return res.status(401).json({ message: "Invalid session data. Please log in again." });
        }

        console.log("Extracted userId:", userId); // Debug log

        if (!productId) {
            console.log("Missing productId"); // Debug log
            return res.status(400).json({ message: "Product ID is required" });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            console.log("Invalid productId:", productId); // Debug log
            return res.status(400).json({ message: "Invalid Product ID" });
        }

        const productObjectId = new mongoose.Types.ObjectId(productId);
        const userObjectId = new mongoose.Types.ObjectId(userId);

        const product = await Product.findById(productObjectId);
        if (!product) {
            console.log("Product not found for ID:", productId); // Debug log
            return res.status(404).json({ message: "Product not found" });
        }

        console.log("Product found:", product.productName); // Debug log

        if (product.isBlocked || product.isUnlisted) {
            console.log("Product unavailable:", product.productName); // Debug log
            return res.status(400).json({ message: "This product is not available" });
        }

        if (product.quantity <= 0) {
            console.log("Product out of stock:", product.productName); // Debug log
            return res.status(400).json({ message: "This product is out of stock" });
        }

        let cart = await Cart.findOne({ userId: userObjectId });
        console.log("Cart found:", cart ? "Yes" : "No"); // Debug log

        if (!cart) {
            cart = new Cart({ userId: userObjectId, products: [] });
            console.log("New cart created for user:", userId); // Debug log
        }

        if (cart.products.length >= 4 && !cart.products.some(item => item.productId.equals(productObjectId))) {
            console.log("Cart limit exceeded"); // Debug log
            return res.status(400).json({ message: "Cart cannot contain more than 4 different products" });
        }

        const existingProduct = cart.products.find(item => item.productId.equals(productObjectId));
        if (existingProduct) {
            if (existingProduct.quantity + 1 > product.quantity) {
                console.log("Stock limit reached for:", product.productName); // Debug log
                return res.status(400).json({ message: "Cannot add more of this product. Maximum stock limit reached." });
            }
            
            existingProduct.quantity += 1;
            existingProduct.totalPrice = existingProduct.quantity * product.salesPrice;
            console.log("Updated quantity for:", product.productName); // Debug log
        } else {
            cart.products.push({
                productId: productObjectId,
                quantity: 1,
                price: product.salesPrice,
                totalPrice: product.salesPrice
            });
            console.log("Added new product to cart:", product.productName); // Debug log
            
            await User.updateOne(
                { _id: userObjectId },
                { $pull: { wishlist: productObjectId } }
            );
        }
  
        await cart.save();
        console.log("Cart saved successfully"); // Debug log
        return res.status(200).json({ message: "Product added to cart successfully!" });

    } catch (error) {
        console.error("Error adding to cart:", error.stack); // Detailed stack trace
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}

// Change product quantity in cart
const changeQuantity = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        let userId;

        if (typeof req.session.user === 'object' && req.session.user.id) {
            userId = req.session.user.id;
        } else {
            userId = req.session.user;
        }

        if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ status: false, error: "Invalid ID format" });
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);
        const productObjectId = new mongoose.Types.ObjectId(productId);

        const product = await Product.findById(productObjectId);
        if (!product) {
            return res.status(404).json({ status: false, error: "Product not found" });
        }

        if (quantity > product.quantity) {
            return res.status(400).json({ status: false, error: `Only ${product.quantity} items available in stock` });
        }

        const cart = await Cart.findOne({ userId: userObjectId });
        if (!cart) {
            return res.status(404).json({ status: false, error: "Cart not found" });
        }

        const productInCart = cart.products.find(item => item.productId.equals(productObjectId));
        if (!productInCart) {
            return res.status(404).json({ status: false, error: "Product not in cart" });
        }

        productInCart.quantity = parseInt(quantity);
        productInCart.totalPrice = productInCart.quantity * product.salesPrice;

        await cart.save();

        // Calculate grand total
        let grandTotal = 0;
        cart.products.forEach(item => {
            grandTotal += item.totalPrice;
        });

        res.json({
            status: true,
            quantityInput: productInCart.quantity,
            totalAmount: productInCart.totalPrice,
            grandTotal: grandTotal
        });
    } catch (error) {
        console.error("Error in changeQuantity:", error);
        res.status(500).json({ status: false, error: "Server error" });
    }
};
// Delete product from cart
const deleteProduct = async (req, res) => {
    try {
        const productId = req.query.id;
        
        let userId;
        if (typeof req.session.user === 'object' && req.session.user.id) {
            userId = req.session.user.id;
        } else {
            userId = req.session.user;
        }
        
        if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.redirect("/pageNotFound");
        }
        
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const productObjectId = new mongoose.Types.ObjectId(productId);
        
        await Cart.updateOne(
            { userId: userObjectId },
            { $pull: { products: { productId: productObjectId } } }
        );

        const cart = await Cart.findOne({ userId: userObjectId });

        let grandTotal = 0;
        let totalQuantity = 0;

        if (cart && cart.products.length > 0) {
            for (const item of cart.products) {
                const prod = await Product.findById(item.productId);
                grandTotal += item.quantity * prod.salesPrice;
                totalQuantity += item.quantity;
            }
        }

        res.json({
            status: true,
            grandTotal: grandTotal,
            totalQuantity: totalQuantity
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, error: "Server error" });
    }
};





module.exports = {
    getCartPage,
    addToCart,
    changeQuantity,
    deleteProduct,
};