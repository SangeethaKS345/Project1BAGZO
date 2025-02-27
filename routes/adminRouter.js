const express = require('express');
const router = express.Router();
const adminController= require("../controllers/admin/adminController");
const {userAuth,adminAuth} = require("../middlewares/auth");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");
const multer = require("multer");
const storage = require("../helpers/multer")
const uploads = require("../helpers/multer");
const { adminErrorHandler} = require("../middlewares/errorHandler");
//error handler
router.use(adminErrorHandler);




router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/dashboard",adminController.loadDashboard);
router.get("/",adminAuth,adminController.loadDashboard);

router.get("/logout",adminController.logout);

router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer",adminAuth,customerController.customerBlocked);
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked);


router.get("/category",adminAuth,categoryController.categoryInfo);
router.post("/addCategory",adminAuth,categoryController.addCategory);
router.get('/editCategory', categoryController.getEditCategory);
router.put("/editCategory/:id", adminAuth, categoryController.editCategory);
router.get("/listCategory", adminAuth, categoryController.getListCategory);
router.get("/unlistCategory", adminAuth, categoryController.getUnlistCategory);
router.delete('/deleteCategory/:id', categoryController.deleteCategory);


router.get("/brands",adminAuth,brandController.getBrandPage);
router.post("/addBrand", adminAuth, uploads.single("image"), brandController.addBrand);
router.get("/blockBrand",adminAuth,brandController.blockBrand);
router.get("/unBlockBrand",adminAuth,brandController.unBlockBrand);
router.get("/deleteBrand",adminAuth,brandController.deletBrand);

//product Management
router.get("/addProducts",adminAuth,productController.getProductAddPage)
router.post("/addProducts",uploads.array("images",4),productController.addProducts);
router.get("/products",adminAuth,productController.getAllProducts)



router.get("/blockProduct",adminAuth,productController.blockProduct);
router.get("/unblockProduct",adminAuth,productController.unblockProduct);
router.get("/editProduct",adminAuth,productController.getEditProduct);
router.post("/editProduct/:id",adminAuth,uploads.array("images",4),productController.editProduct)
router.post("/deleteImage",adminAuth,productController.deleteSingleImage);


// router.get('/pageerror', adminAuth, (req, res) => {
//     res.render('admin/error', { 
//         message: 'An error occurred',
//         error: {status: 500}
//     });
// });

module.exports = router;