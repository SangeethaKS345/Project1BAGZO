const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");

// Get Brand Page
const getBrandPage = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";

        let searchConditions = [];
        const searchRegex = new RegExp(search, "i");

        // Text-based search
        searchConditions.push({ brandName: { $regex: searchRegex } });
        // Status search
        if (search.toLowerCase().includes('block')) {
            searchConditions.push({ isBlocked: true });
        } else if (search.toLowerCase().includes('active')) {
            searchConditions.push({ isBlocked: false });
        }

        const brandData = await Brand.find({
            $or: searchConditions
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const totalBrands = await Brand.countDocuments({
            $or: searchConditions
        });
        const totalPages = Math.ceil(totalBrands / limit);

        res.render("brands", {
            data: brandData.reverse(),
            currentPage: page,
            totalPages: totalPages,
            totalBrands: totalBrands,
            search: search // Pass search term back to template
        });
    } catch (error) {
        next(error);
    }
};

// Add Brand
const addBrand = async (req, res, next) => {
    try {
        console.log("Request received for adding a brand:", req.body);
        console.log("Uploaded file:", req.file);

        if (!req.file) {
            console.log("No file uploaded");
            return res.redirect("/admin/brands?error=noimage");
        }

        const brand = req.body.name
            .trim()
            .toLowerCase()
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

        const findBrand = await Brand.findOne({ brandName: brand });

        if (!findBrand) {
            const image = req.file.filename;
            console.log("Saving new brand:", brand, image);

            const newBrand = new Brand({
                brandName: brand,
                brandImage: image,
            });

            await newBrand.save();
            return res.redirect("/admin/brands");
        }

        console.log("Brand already exists");
        res.redirect("/admin/brands?error=exists&name=" + encodeURIComponent(brand));
    } catch (error) {
        next(error);
    }
};

// Block Brand
const blockBrand = async (req, res, next) => {
    try {
        const id = req.query.id;
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
        const id = req.query.id;
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