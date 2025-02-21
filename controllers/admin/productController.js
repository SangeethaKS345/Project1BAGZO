const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharo = require("sharp");


const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });
    res.render("product-add", {
      cat: category,
      brand: brand,
    });
  } catch (error) {
    res.status(500).render('admin/error', { 
      message: 'An error occurred',
      error: {status: 500}
  });
  }
};




const addProducts = async (req, res) => {
  try {
      console.log("hello")
      console.log(req.files);
      const products = req.body;

      // Check if product already exists
      const productExists = await Product.findOne({
          productName: products.productName,
      });

      if (!productExists) {
          const images = [];

          if (req.files && req.files.length > 0) {
              for (let i = 0; i < req.files.length; i++) {
                  images.push(`${req.files[i].filename}`);
              }
              console.log(images);
          }

          // Create new product - now using category ID directly
          const newProduct = new Product({
              productName: products.productName,
              description: products.description,
              brand: products.brand,
              category: products.category, // This will now be the ObjectId
              regularPrice: products.regularPrice,
              salesPrice: products.salePrice,
              createdOn: new Date(),
              quantity: products.quantity,
              size: products.size,
              color: products.color,
              productImage: images
          });

          await newProduct.save();
          return res.redirect("/admin/addProducts");
      } else {
          return res.status(400).json({
              error: "Product already exists, please try with another name",
          });
      }
  } catch (error) {
      console.error("Error saving product:", error);
      return res.redirect("/admin/pageerror");
  }
};

const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    
    const searchRegex = new RegExp(search, "i");
    const brands = await Brand.find({ name: { $regex: searchRegex } }).select("_id");
    const productData = await Product.find({
      $or: [
        { productName: { $regex: searchRegex }},
        { brand: { $in: brands.map(b => b._id) } },
      ],
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({createdOn: -1})
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

    console.log(productData)
    if (!productData) {
      return res.status(404).render("admin/products", {
        data: [],
        currentPage: page,
        totalPages: 0,
        cat: category,
        brand: brand,
      });
    }

    res.render("products", {
      data: productData,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      cat: category,
      brand: brand,
    });

  } catch (error) {
    console.error("Error in getAllProducts:", error);
    res.status(500).render('error', { 
      message: 'Error loading products',
      error: {status: 500}
    });
  }
};

const blockProduct = async (req, res) => {
  console.log("block");

  try {
    let id = req.query.id;
    console.log(id);
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/products");
  } catch (error) {
    res.status(500).render('admin/error', { 
      message: 'An error occurred',
      error: {status: 500}
  });
  }
};

const unblockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/products");
  } catch (error) {
    res.status(500).render('admin/error', { 
      message: 'An error occurred',
      error: {status: 500}
  });
  }
  console.log(req.query.id);
};


const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id }).populate('brand');
    const category = await Category.find({});
    const brand = await Brand.find({});
    
    // Add pagination variables
    const totalPages = 1;
    const currentPage = 1;

    res.render("edit-product", {
      product: product,
      cat: category,
      brand: brand,
      totalPages: totalPages,
      currentPage: currentPage
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).render('error', { 
      message: 'An error occurred while fetching the product',
      error: {status: 500}
    });
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

    // Handle image updates
    let updatedImages = [...(product.productImage || [])];
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => file.filename);
      updatedImages = [...updatedImages, ...newImages];
    }

    // Fields to update
    const updateFields = {
      productName: data.productName,
      description: data.descriptionData,
      brand: data.brand,           // Now receiving ObjectId from the form
      category: data.category,
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
      console.log(`Image${imageNameToServer} deleted successfully`);
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