const Coupons = require('../../models/couponSchema');

const getCouponPage = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";

        let searchConditions = [];
        const searchRegex = new RegExp(search, "i");
        const searchNum = parseFloat(search);

        // Text-based searches
        searchConditions.push({ code: { $regex: searchRegex } });
        // Number-based searches
        if (!isNaN(searchNum)) {
            searchConditions.push({ offerPrice: searchNum });
            searchConditions.push({ minimumPrice: searchNum });
            searchConditions.push({ maxUses: searchNum });
            searchConditions.push({ usesCount: searchNum });
        }
        // Date searches (partial match on ISO string)
        if (search.length >= 4) { // Minimum length to avoid too broad searches
            searchConditions.push({ startOn: { $regex: searchRegex } });
            searchConditions.push({ expireOn: { $regex: searchRegex } });
        }
        // Status search
        if (search.toLowerCase().includes('active')) {
            searchConditions.push({ isListed: true });
        } else if (search.toLowerCase().includes('inactive')) {
            searchConditions.push({ isListed: false });
        }

        const totalCoupons = await Coupons.countDocuments({ 
            isDeleted: false,
            $or: searchConditions
        });
        const totalPages = Math.ceil(totalCoupons / limit);

        const coupons = await Coupons.find({ 
            isDeleted: false,
            $or: searchConditions
        })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

        res.render('coupon', { 
            coupons,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            search: search // Pass search term back to template
        });
    } catch (error) {
        next(error);
    }
};

const addCoupon = async (req, res) => {
    try {
        let { code, offerPrice, minimumPrice, startOn, maxUses, expireOn } = req.body;

        if (!code || typeof code !== 'string' || code.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Valid coupon code is required'
            });
        }

        code = code.trim().toUpperCase();

        const newCoupon = new Coupons({
            code,
            offerPrice: Number(offerPrice),
            minimumPrice: Number(minimumPrice),
            startOn: new Date(startOn),
            maxUses: Number(maxUses),
            expireOn: new Date(expireOn),
            createdOn: new Date(),
            usesCount: 0,
            isListed: true,
            isDeleted: false
        });

        await newCoupon.save();

        res.status(200).json({
            success: true,
            message: 'Coupon created successfully'
        });
    } catch (error) {
        console.error('Error in addCoupon:', error);
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'This coupon code already exists'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const toggleCouponStatus = async (req, res) => {
    try {
        const { couponId } = req.params;
        const coupon = await Coupons.findById(couponId);
        const newStatus = !coupon.isListed;
        await Coupons.findByIdAndUpdate(couponId, { isListed: newStatus });
        res.status(200).json({ 
            success: true, 
            message: `Coupon ${newStatus ? 'listed' : 'unlisted'} successfully`,
            isListed: newStatus
        });
    } catch (error) {
        console.error('Error in toggleCouponStatus:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const applyCoupon = async (req, res) => {
    // ... existing code ...
};

const editCoupon = async (req, res) => {
    try {
        const { couponId } = req.params;
        const { code, offerPrice, minimumPrice, startOn, maxUses, expireOn } = req.body;

        if (!code || typeof code !== 'string' || code.trim() === '') {
            return res.status(400).json({ success: false, message: 'Valid coupon code is required' });
        }

        const updatedCoupon = await Coupons.findByIdAndUpdate(
            couponId,
            {
                code: code.trim().toUpperCase(),
                offerPrice: Number(offerPrice),
                minimumPrice: Number(minimumPrice),
                startOn: new Date(startOn),
                maxUses: Number(maxUses),
                expireOn: new Date(expireOn)
            },
            { new: true }
        );

        if (!updatedCoupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        res.status(200).json({ success: true, message: 'Coupon updated successfully' });
    } catch (error) {
        console.error('Error in editCoupon:', error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'This coupon code already exists' });
        }
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteCoupon = async (req, res) => {
    try {
        const { couponId } = req.params;
        const coupon = await Coupons.findByIdAndUpdate(
            couponId,
            { isDeleted: true },
            { new: true }
        );

        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Coupon deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteCoupon:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getCoupon = async (req, res) => {
    try {
        const { couponId } = req.params;
        const coupon = await Coupons.findById(couponId);

        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        res.status(200).json({
            success: true,
            coupon
        });
    } catch (error) {
        console.error('Error in getCoupon:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    getCouponPage,
    addCoupon,
    toggleCouponStatus,
    applyCoupon,
    editCoupon,
    deleteCoupon,
    getCoupon
};