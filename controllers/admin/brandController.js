const Brand = require("../../models/brandSchema");

// Get Brand Page
const getBrandPage = async (req, res, next) => {
    try {
        const perPage = parseInt(req.query.limit, 4) || 4; // Default to 4 items per page
        const page = parseInt(req.query.page, 4) || 1; // Default to page 1
        const search = req.query.search || ""; // Search term
        const status = req.query.status || "all"; // Status filter

        const query = {}; // Base query

        // Add search conditions
        if (search) {
            query.brandName = { $regex: search, $options: "i" };
        }

        // Filter by status
        if (status === "block") {
            query.isBlocked = true;
        } else if (status === "unblock") {
            query.isBlocked = false;
        }

        // Fetch brands and total count
        const [brands, totalBrands] = await Promise.all([
            Brand.find(query)
                .sort({ createdAt: -1 }) // Sort by creation date
                .skip((page - 1) * perPage)
                .limit(perPage),
            Brand.countDocuments(query),
        ]);

        const totalPages = Math.ceil(totalBrands / perPage);

        // Render the brands page
        res.render("brands", {
            data: brands,
            currentPage: page,
            totalPages,
            perPage,
            search,
            status,
        });
    } catch (error) {
        console.error("Error rendering brands page:", error);
        next(error);
    }
};

// Add Brand
const addBrand = async (req, res, next) => {
    try {
        const { name } = req.body;
        const file = req.file; // Use req.file for single file upload

        if (!file) {
            return res.redirect("/admin/brands?error=" + encodeURIComponent("No image provided"));
        }

        if (!name || name.trim() === "") {
            return res.redirect("/admin/brands?error=" + encodeURIComponent("Brand name is required"));
        }

        const formattedBrand = name.trim().toLowerCase()
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

        const existingBrand = await Brand.findOne({ brandName: formattedBrand });

        if (existingBrand) {
            return res.redirect("/admin/brands?error=" + encodeURIComponent(`Brand "${formattedBrand}" already exists`));
        }

        const newBrand = new Brand({
            brandName: formattedBrand,
            brandImage: file.filename,
        });

        await newBrand.save();
        res.redirect("/admin/brands?success=" + encodeURIComponent("Brand added successfully"));
    } catch (error) {
        console.error("Error adding brand:", error);
        res.redirect("/admin/brands?error=" + encodeURIComponent("Failed to add brand"));
        next(error);
    }
};

const blockBrand = async (req, res, next) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ success: false, message: "Brand ID is required." });
        }
        const result = await Brand.updateOne(
            { _id: id },
            { $set: { isBlocked: true } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: "Brand not found." });
        }
        res.status(200).json({
            success: true,
            message: "Brand has been successfully blocked.",
        });
    } catch (error) {
        console.error("Error blocking brand:", error);
        res.status(500).json({ success: false, message: "Failed to block brand." });
        next(error);
    }
};

const unBlockBrand = async (req, res, next) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ success: false, message: "Brand ID is required." });
        }
        const result = await Brand.updateOne(
            { _id: id },
            { $set: { isBlocked: false } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: "Brand not found." });
        }
        res.status(200).json({
            success: true,
            message: "Brand has been successfully unblocked.",
        });
    } catch (error) {
        console.error("Error unblocking brand:", error);
        res.status(500).json({ success: false, message: "Failed to unblock brand." });
        next(error);
    }
};

// Delete Brand
const deleteBrand = async (req, res, next) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, message: "Brand ID is required." });
        }

        const brand = await Brand.findById(id);
        if (!brand) {
            return res.status(404).json({ success: false, message: "Brand not found." });
        }

        await Brand.deleteOne({ _id: id });

        res.status(200).json({
            success: true,
            message: "Brand has been successfully deleted.",
        });
    } catch (error) {
        console.error("Error deleting brand:", error);
        res.status(500).json({ success: false, message: "Failed to delete brand." });
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