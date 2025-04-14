const Category = require("../../models/categorySchema.js");

// Load Category Page
const categoryInfo = async (req, res, next) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const query = {};

        // Add search conditions
        if (search) {
            const searchNumber = parseFloat(search); // Try to parse search as a number for categoryOffer
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            ];
            // If search term is a number, include categoryOffer in the search
            if (!isNaN(searchNumber)) {
                query.$or.push({ categoryOffer: searchNumber });
            }
        }

        // Filter by status
        if (status === 'listed') {
            query.isListed = true;
        } else if (status === 'unlisted') {
            query.isListed = false;
        }

        const [categoryData, totalCategories] = await Promise.all([
            Category.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Category.countDocuments(query)
        ]);

        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages: Math.ceil(totalCategories / limit),
            search,
            status
        });
    } catch (error) {
        next(error);
    }
};

// Category Name Standardization
const standardizeCategoryName = (name) => {
    return name.trim().split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

// Add Category
const addCategory = async (req, res, next) => {
    try {
        const { name, description } = req.body;

        if (!name || !description) {
            return res.status(400).json({ error: "Name and description are required" });
        }

        const standardizedName = standardizeCategoryName(name);

        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${standardizedName}$`, 'i') }
        });

        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }

        const newCategory = new Category({ name: standardizedName, description });
        await newCategory.save();

        res.json({ message: "Category added successfully" });
    } catch (error) {
        next(error);
    }
};

// Get Edit Category Page
const getEditCategory = async (req, res, next) => {
    try {
        const category = await Category.findById(req.query.id);
        if (!category) return res.redirect("/pageError");
        res.render("editCategory", { category });
    } catch (error) {
        next(error);
    }
};

// Edit Category
const editCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { categoryName, description } = req.body;

        if (!categoryName || !description) {
            return res.status(400).json({ success: false, error: "Category name and description are required" });
        }

        const standardizedName = standardizeCategoryName(categoryName);

        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${standardizedName}$`, 'i') },
            _id: { $ne: id }
        });

        if (existingCategory) {
            return res.status(400).json({ success: false, error: "Category exists, please choose another name" });
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name: standardizedName, description },
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ success: false, error: "Category not found" });
        }

        res.json({ success: true, message: "Category updated successfully", category: updatedCategory });
    } catch (error) {
        next(error);
    }
};

// Get List Category
const updateCategoryListing = async (req, res, next, isListed) => {
    try {
        await Category.updateOne({ _id: req.query.id }, { $set: { isListed } });
        res.json({ success: true, message: `Category ${isListed ? 'listed' : 'unlisted'} successfully` });
    } catch (error) {
        next(error);
    }
};

// Unlist and list Category
const getListCategory = (req, res, next) => updateCategoryListing(req, res, next, true);
const getUnlistCategory = (req, res, next) => updateCategoryListing(req, res, next, false);

// Delete Category
const deleteCategory = async (req, res, next) => {
    try {
        const deletedCategory = await Category.findByIdAndDelete(req.params.id);
        if (!deletedCategory) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// Add Category Offer
const addCategoryOffer = async (req, res, next) => {
    try {
        const { categoryId, percentage, endDate } = req.body;

        if (!categoryId || !percentage || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Category ID, percentage, and end date are required"
            });
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        const parsedPercentage = parseInt(percentage);
        if (isNaN(parsedPercentage) || parsedPercentage < 0 || parsedPercentage > 100) {
            return res.status(400).json({
                success: false,
                message: "Offer percentage must be a number between 0 and 100"
            });
        }

        const today = new Date().setHours(0, 0, 0, 0);
        const offerEndDate = new Date(endDate);
        if (offerEndDate < today) {
            return res.status(400).json({
                success: false,
                message: "End date cannot be in the past"
            });
        }

        await Category.updateOne(
            { _id: categoryId },
            {
                $set: {
                    categoryOffer: parsedPercentage,
                    offerEndDate: offerEndDate
                }
            }
        );

        res.json({
            success: true,
            message: "Category offer added successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Something went wrong while adding the offer",
            error: error.message
        });
    }
};

// Remove Category Offer
const removeCategoryOffer = async (req, res, next) => {
    try {
        const categoryId = req.params.categoryId;
        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        await Category.updateOne(
            { _id: categoryId },
            { $set: { categoryOffer: 0, offerEndDate: null } }
        );

        res.json({ success: true, message: "Offer removed successfully" });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    categoryInfo,
    addCategory,
    getEditCategory,
    editCategory,
    getListCategory,
    getUnlistCategory,
    deleteCategory,
    addCategoryOffer,
    removeCategoryOffer
};