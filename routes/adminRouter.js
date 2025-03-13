const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const { adminAuth } = require("../middlewares/auth");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");
const ordersController = require("../controllers/admin/ordersController");
const uploads = require("../helpers/multer");
const { adminErrorHandler } = require("../middlewares/errorHandler");

// Error handler
router.use(adminErrorHandler);

// Admin Login & Dashboard Routes
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/dashboard", adminAuth, adminController.loadDashboard); 
router.get("/", adminAuth, adminController.loadDashboard);
router.get("/logout", adminController.logout);

// Customer Management
router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerunBlocked);

// Category Management
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.get("/editCategory", adminAuth, categoryController.getEditCategory); 
router.put("/editCategory/:id", adminAuth, categoryController.editCategory);
router.get("/listCategory", adminAuth, categoryController.getListCategory);
router.get("/unlistCategory", adminAuth, categoryController.getUnlistCategory);
router.delete("/deleteCategory/:id", adminAuth, categoryController.deleteCategory);

// Brand Management
router.get("/brands", adminAuth, brandController.getBrandPage);
router.post("/addBrand", adminAuth, uploads.single("image"), brandController.addBrand);
router.get("/blockBrand", adminAuth, brandController.blockBrand);
router.get("/unBlockBrand", adminAuth, brandController.unBlockBrand);
router.get("/deleteBrand", adminAuth, brandController.deleteBrand);

// Product Management
router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts", adminAuth, uploads.array("images", 4), productController.addProducts); 
router.get("/products", adminAuth, productController.getAllProducts);
router.get("/blockProduct", adminAuth, productController.blockProduct);
router.get("/unblockProduct", adminAuth, productController.unblockProduct);
router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post("/editProduct/:id", adminAuth, uploads.array("images", 4), productController.editProduct);
router.post("/deleteImage", adminAuth, productController.deleteSingleImage);

// Orders Management
router.get("/orders", adminAuth, ordersController.getAllOrders);
router.get("/orders/details/:orderId", adminAuth, ordersController.getOrderDetails);
router.post("/orders/update-status/:orderId", adminAuth, ordersController.updateOrderStatus);
router.get("/orders/return-requests", adminAuth, ordersController.getReturnRequests);
router.post("/orders/update-return-status/:orderId", adminAuth, ordersController.updateReturnStatus);

module.exports = router;
