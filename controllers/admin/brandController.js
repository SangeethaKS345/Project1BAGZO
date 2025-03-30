const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");

// Get Brand Page
const getBrandPage = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";

        const searchRegex = new RegExp(search, "i");
        const searchConditions = [
            { brandName: { $regex: searchRegex } },
            ...(search.toLowerCase().includes('block') ? [{ isBlocked: true }] : search.toLowerCase().includes('active') ? [{ isBlocked: false }] : [])
        ];

        const [brandData, totalBrands] = await Promise.all([
            Brand.find({ $or: searchConditions }).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Brand.countDocuments({ $or: searchConditions })
        ]);

        const totalPages = Math.ceil(totalBrands / limit);

        res.render("brands", {
            data: brandData.reverse(),
            currentPage: page,
            totalPages,
            totalBrands,
            search // Pass search term back to template
        });
    } catch (error) {
        next(error);
    }
};

// Add Brand
const addBrand = async (req, res, next) => {
    try {
        const { name } = req.body;
        const { file } = req;

        if (!file) {
            return res.redirect("/admin/brands?error=noimage");
        }

        const formattedBrand = name.trim().toLowerCase()
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

        const existingBrand = await Brand.findOne({ brandName: formattedBrand });

        if (existingBrand) {
            return res.redirect(`/admin/brands?error=exists&name=${encodeURIComponent(formattedBrand)}`);
        }

        const newBrand = new Brand({
            brandName: formattedBrand,
            brandImage: file.filename,
        });

        await newBrand.save();
        res.redirect("/admin/brands");
    } catch (error) {
        next(error);
    }
};

// Block Brand
const blockBrand = async (req, res, next) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.redirect("/admin/brands?error=invalidid");
        }

        await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect("/admin/brands");
    } catch (error) {
        next(error);
    }
};

// Unblock Brand
const unBlockBrand = async (req, res, next) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.redirect("/admin/brands?error=invalidid");
        }

        await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect("/admin/brands");
    } catch (error) {
        next(error);
    }
};

// Delete Brand
const deleteBrand = async (req, res, next) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).redirect("/admin/brands?error=invalidid");
        }

        await Brand.deleteOne({ _id: id });
        res.redirect("/admin/brands");
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getBrandPage,
    addBrand,
    blockBrand,
    unBlockBrand,
    deleteBrand,
};