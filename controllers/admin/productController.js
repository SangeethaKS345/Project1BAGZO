const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
//const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
//const sharo = require("sharp");


const getProductAddPage = async (req, res, next) => {
  try {
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });
<<<<<<< HEAD
    res.render("product-add", { cat: category, brand: brand });
=======
    res.render("productAdd", { cat: category, brand: brand });
>>>>>>> 334f225 (cart page added. working on profile page.)
  } catch (error) {
    next(error); // Pass error to middleware
  }
};

// Function to add products
const addProducts = async (req, res, next) => {
  try {
    console.log("hello");
    console.log(req.files);

    const products = req.body;
    const productExists = await Product.findOne({ productName: products.productName });

    if (productExists) {
      return res.status(400).json({ error: "Product already exists, please try another name" });
    }

    const images = [];
    if (req.files && req.files.length > 0) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      const maxSize = 5 * 1024 * 1024;

      for (let file of req.files) {
        if (!allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({ error: `Invalid file type for ${file.originalname}` });
        }
        if (file.size > maxSize) {
          return res.status(400).json({ error: `File ${file.originalname} exceeds max size of 5MB.` });
        }
        images.push(file.filename);
      }
    }

    const newProduct = new Product({
      productName: products.productName,
      description: products.description,
      brand: products.brand,
      category: products.category,
      regularPrice: products.regularPrice,
      salesPrice: products.salePrice,
      createdOn: new Date(),
      quantity: products.quantity,
      size: products.size,
      color: products.color,
      productImage: images
    });

    await newProduct.save();
    res.redirect("/admin/addProducts");
  } catch (error) {
<<<<<<< HEAD
    next(error); // Pass error to middleware
=======
    next(error); 
>>>>>>> 334f225 (cart page added. working on profile page.)
  }
};

// Function to get all products
const getAllProducts = async (req, res, next) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    const searchRegex = new RegExp(search, "i");
    const brands = await Brand.find({ name: { $regex: searchRegex } }).select("_id");
    const productData = await Product.find({
      $or: [
        { productName: { $regex: searchRegex }},
        { brand: { $in: brands.map(b => b._id) } }
      ],
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ createdOn: -1 })
      .populate("category")
      .populate("brand")
      .exec();

    const count = await Product.countDocuments({
      $or: [
        { productName: { $regex: searchRegex }},
        { brand: { $in: brands.map(b => b._id) } }
      ],
    });

    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    const safeProductData = productData.map(product => ({
      ...product.toObject(),
      brand: product.brand || { brandName: 'Unknown' },
      category: product.category || { name: 'Uncategorized' },
    }));

    res.render("products", {
      data: safeProductData,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      cat: category,
      brand: brand,
    });
  } catch (error) {
    next(error); // Pass error to middleware
  }
};

// Function to block a product
const blockProduct = async (req, res, next) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/products");
  } catch (error) {
    next(error);
  }
};

// Function to unblock a product
const unblockProduct = async (req, res, next) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/products");
  } catch (error) {
    next(error);
  }
};

// Function to get edit product page
const getEditProduct = async (req, res, next) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id }).populate('brand');
    const category = await Category.find({});
    const brand = await Brand.find({});
    
    res.render("editProduct", {
      product: product,
      cat: category,
      brand: brand,
      totalPages: 1,
      currentPage: 1
    });
  } catch (error) {
    next(error);
  }
};



const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findOne({ _id: id });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const data = req.body;

    // Check for existing product name
    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id },
    });

    if (existingProduct) {
      return res.status(400).json({
        error: "Product with this name already exists. Please try with another name.",
      });
    }

    const brand = await Brand.findOne({ brandName: data.brand });
    if (!brand) {
      return res.status(400).json({ error: "Brand not found" });
    }

    const category = await Category.findOne({ name: data.category });
    if (!category) {
      return res.status(400).json({ error: "Category not found" });
    }

    // Handle image updates
    let updatedImages = [];
    
    // If new images were uploaded, replace the old ones completely
    if (req.files && req.files.length > 0) {
      // Delete old image files from the server
      if (product.productImage && product.productImage.length > 0) {
        product.productImage.forEach(imageName => {
          const imagePath = path.join("public", "uploads", "re-image", imageName);
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`Deleted old image: ${imageName}`);
          }
        });
      }
      
      // Use only the new images
      updatedImages = req.files.map(file => file.filename);
      console.log("New images:", updatedImages);
    } else {
      // If no new images were uploaded, keep the existing ones
      updatedImages = [...(product.productImage || [])];
    }

    // Fields to update
    const updateFields = {
      productName: data.productName,
      description: data.descriptionData,
      brand: brand._id,
      category: category._id,
      regularPrice: parseFloat(data.regularPrice),
      salesPrice: parseFloat(data.salesPrice),
      quantity: parseInt(data.quantity),
      color: data.color,
      productImage: updatedImages
    };

    // Update product in the database
    const updatedProduct = await Product.findByIdAndUpdate(
      { _id: id },
      updateFields,
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(500).json({ error: "Failed to update product" });
    }

    return res.redirect("/admin/products");

  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).render('error', { 
      message: 'An error occurred while updating the product',
      error: {status: 500}
    });
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;
    const product = await Product.findByIdAndUpdate(productIdToServer, {
      $pull: { productImage: imageNameToServer },
    });
    const imagePath = path.join(
      "public",
      "uploads",
      "re-image",
      imageNameToServer
    );
    if (fs.existsSync(imagePath)) {
      await fs.unlinkSync(imagePath);
      console.log(`Image ${imageNameToServer} deleted successfully`);
    } else {
      console.log(`Image ${imageNameToServer} not found `);
    }
    res.send({ status: true });
  } catch (error) {
    res.status(500).render('admin/error', { 
      message: 'An error occurred',
      error: {status: 500}
    });
  }
};

module.exports = {
  getProductAddPage,
  addProducts,
  getAllProducts,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
};