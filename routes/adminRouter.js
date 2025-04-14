const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const { adminAuth, redirectIfAuthenticated } = require("../middlewares/auth");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");
const ordersController = require("../controllers/admin/ordersController");
const couponController = require("../controllers/admin/couponController");
const dashboardController = require("../controllers/admin/dashboardController");
const walletController = require("../controllers/admin/walletController");
const uploads = require("../helpers/multer");
const { adminErrorHandler } = require("../middlewares/errorHandler");

// Error handler
router.use(adminErrorHandler);

// Admin Login & Logout Routes
router.get("/login", redirectIfAuthenticated, adminController.loadLogin);
router.post("/login", redirectIfAuthenticated, adminController.login);
router.get("/logout", adminController.logout);

// Dashboard Routes
router.get("/dashboard", adminAuth, dashboardController.loadDashboard);
router.get("/", adminAuth, dashboardController.loadDashboard);
router.get('/dashboard/chartData', dashboardController.getChartData);
router.get('/downloadReport', dashboardController.downloadReport);

// Customer Management
router.get("/users", adminAuth, customerController.renderCustomersPage);
router.post("/blockCustomer", adminAuth, customerController.blockCustomer);
router.post("/unblockCustomer", adminAuth, customerController.unblockCustomer);

// Category Management
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.get("/editCategory", adminAuth, categoryController.getEditCategory);
router.put("/editCategory/:id", adminAuth, categoryController.editCategory);
router.get("/listCategory", adminAuth, categoryController.getListCategory);
router.get("/unlistCategory", adminAuth, categoryController.getUnlistCategory);
router.delete("/deleteCategory/:id", adminAuth, categoryController.deleteCategory);
router.post("/addCategoryOffer", adminAuth, categoryController.addCategoryOffer);
router.delete("/removeCategoryOffer/:categoryId", adminAuth, categoryController.removeCategoryOffer);

//Brand Management
router.get("/brands", adminAuth, brandController.getBrandPage);
router.post("/addBrand", adminAuth, uploads.single("image"), brandController.addBrand);
router.post("/blockBrand", adminAuth, brandController.blockBrand); 
router.post("/unBlockBrand", adminAuth, brandController.unBlockBrand); 
router.post("/deleteBrand", adminAuth, brandController.deleteBrand); 

// Product Management
router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts", adminAuth, uploads.array("images", 4), productController.addProducts);
router.get("/products", adminAuth, productController.getAllProducts);
router.post("/blockProduct", adminAuth, productController.blockProduct); // Changed from GET to POST
router.post("/unblockProduct", adminAuth, productController.unblockProduct); // Changed from GET to POST
router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post("/editProduct/:id", adminAuth, uploads.array("images", 4), productController.editProduct);
router.post("/deleteImage", adminAuth, productController.deleteSingleImage);
router.post("/addProductOffer", adminAuth, productController.addProductOffer);
router.post("/removeProductOffer/:productId", adminAuth, productController.removeProductOffer);

// Orders Management
router.get("/orders", adminAuth, ordersController.getAllOrders);
router.get("/orders/details/:orderId", adminAuth, ordersController.getOrderDetails);
router.post("/orders/update-status/:orderId", adminAuth, ordersController.updateOrderStatus);
router.get("/orders/return-requests", adminAuth, ordersController.getReturnRequests);
router.post("/orders/update-return-status/:orderId", adminAuth, ordersController.updateReturnStatus);

// Coupon Routes
router.get('/coupon', adminAuth, couponController.getCouponPage);
router.post('/addCoupon', adminAuth, couponController.addCoupon);
router.put('/coupon/toggle/:couponId', couponController.toggleCouponStatus);
router.patch('/editCoupon/:couponId', adminAuth, couponController.editCoupon);
router.delete('/deleteCoupon/:couponId', adminAuth, couponController.deleteCoupon);
router.get('/getCoupon/:couponId', adminAuth, couponController.getCoupon);

// Wallet Management
router.get("/wallet", adminAuth, walletController.loadWalletPage);
router.get('/transaction/:id', walletController.getTransactionDetails);

module.exports = router;