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

        const { productId } = req.body;
        let userId;
        
        if (typeof req.session.user === 'object' && req.session.user.id) {
            userId = req.session.user.id;
        } else {
            userId = req.session.user;
        }

        if (!productId) {
            return res.status(400).json({ message: "Product ID is required" });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: "Invalid Product ID" });
        }

        const productObjectId = new mongoose.Types.ObjectId(productId);
        const userObjectId = new mongoose.Types.ObjectId(userId);

        const product = await Product.findById(productObjectId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (product.isBlocked || product.isUnlisted) {
            return res.status(400).json({ message: "This product is not available" });
        }

        if (product.quantity <= 0) {
            return res.status(400).json({ message: "This product is out of stock" });
        }

        let cart = await Cart.findOne({ userId: userObjectId });

        if (!cart) {
            cart = new Cart({ userId: userObjectId, products: [] });
        }

        // Check cart product limit (max 4 products)
        if (cart.products.length >= 4 && !cart.products.some(item => item.productId.equals(productObjectId))) {
            return res.status(400).json({ message: "Cart cannot contain more than 4 different products" });
        }

        const existingProduct = cart.products.find(item => item.productId.equals(productObjectId));

        if (existingProduct) {
            if (existingProduct.quantity + 1 > product.quantity) {
                return res.status(400).json({ message: "Cannot add more of this product. Maximum stock limit reached." });
            }
            
            existingProduct.quantity += 1;
            existingProduct.totalPrice = existingProduct.quantity * product.salesPrice;
        } else {
            cart.products.push({
                productId: productObjectId,
                quantity: 1,
                price: product.salesPrice,
                totalPrice: product.salesPrice
            });
            
            await User.updateOne(
                { _id: userObjectId },
                { $pull: { wishlist: productObjectId } }
            );
        }
  
        await cart.save();
        return res.status(200).json({ message: "Product added to cart successfully!" });

    } catch (error) {
        console.error("Error adding to cart:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// Change product quantity in cart
function changeQuantity(productId, currentQuantity, change, price, elementId, maxQuantity) {
    const newQuantity = parseInt(currentQuantity) + change;
    if (newQuantity < 1 || newQuantity > maxQuantity) {
        Swal.fire({
            icon: 'error',
            title: 'Invalid Quantity',
            text: `Quantity must be between 1 and ${maxQuantity}`,
        });
        return;
    }

    // Send AJAX request to update server
    $.ajax({
        url: '/cart/changeQuantity',
        method: 'POST',
        data: {
            productId: productId,
            quantity: newQuantity
        },
        success: function(response) {
            console.log('AJAX Success:', response);
            console.log('Updating elementId:', elementId); // Debug elementId
            if (response.status) {
                // Update UI with server values
                const qtyElement = document.getElementById(`cartProductQuantity${elementId}`);
                const subTotalElement = document.getElementById(`subTotal${elementId}`);
                const totalElement = document.getElementById('total');
                const subtotalElement = document.getElementById('subtotal');

                // Debug element existence
                console.log('Qty Element:', qtyElement);
                console.log('Subtotal Element:', subTotalElement);
                console.log('Total Element:', totalElement);
                console.log('Subtotal Element:', subtotalElement);

                if (qtyElement) qtyElement.value = response.quantityInput;
                if (subTotalElement) subTotalElement.innerText = response.totalAmount;
                if (totalElement) totalElement.innerText = response.grandTotal;
                if (subtotalElement) subtotalElement.innerText = response.grandTotal;

                // Add animation if subtotal exists
                if (subTotalElement) {
                    subTotalElement.classList.add('price-updated');
                    setTimeout(() => {
                        subTotalElement.classList.remove('price-updated');
                    }, 800);
                }
            } else {
                // Revert changes if server rejected
                const qtyElement = document.getElementById(`cartProductQuantity${elementId}`);
                const subTotalElement = document.getElementById(`subTotal${elementId}`);
                if (qtyElement) qtyElement.value = currentQuantity;
                if (subTotalElement) subTotalElement.innerText = currentQuantity * price;
                
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: response.error || 'Failed to update quantity'
                });
            }
        },
        error: function(xhr, status, error) {
            console.log('AJAX Error:', status, error);
            const qtyElement = document.getElementById(`cartProductQuantity${elementId}`);
            const subTotalElement = document.getElementById(`subTotal${elementId}`);
            if (qtyElement) qtyElement.value = currentQuantity;
            if (subTotalElement) subTotalElement.innerText = currentQuantity * price;
            
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to connect to server'
            });
        }
    });
}

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