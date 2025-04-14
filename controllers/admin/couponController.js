const Coupons = require("../../models/couponSchema");

const getCouponPage = async (req, res, next) => {
  try {
    const perPage = parseInt(req.query.limit, 10) || 10; // Default to 10 items per page
    const page = parseInt(req.query.page, 10) || 1; // Default to page 1
    const search = req.query.search || ""; // Search term
    const status = req.query.status || "all"; // Status filter (all, listed, unlisted)
    const validity = req.query.validity || "all"; // Validity filter (all, active, expired)

    const query = { isDeleted: false }; // Base query

    // Add search conditions
    if (search) {
      const searchRegex = new RegExp(search, "i");
      const searchNum = parseFloat(search);
      const searchConditions = [{ code: { $regex: searchRegex } }];

      if (!isNaN(searchNum)) {
        searchConditions.push(
          { offerPrice: searchNum },
          { minimumPrice: searchNum },
          { maxUses: searchNum },
          { maxUsesPerUser: searchNum },
          { usesCount: searchNum }
        );
      }
      if (search.length >= 4) {
        searchConditions.push(
          { startOn: { $regex: searchRegex } },
          { expireOn: { $regex: searchRegex } }
        );
      }
      query.$or = searchConditions;
    }

    // Filter by status
    if (status === "listed") {
      query.isListed = true;
    } else if (status === "unlisted") {
      query.isListed = false;
    }

    // Filter by validity
    const today = new Date();
    if (validity === "active") {
      query.expireOn = { $gte: today };
      query.isListed = true; // Active coupons must be listed
    } else if (validity === "expired") {
      query.expireOn = { $lt: today };
    }

    // Fetch coupons and total count
    const [coupons, totalCoupons] = await Promise.all([
      Coupons.find(query)
        .sort({ createdOn: -1 }) // Sort by creation date
        .skip((page - 1) * perPage)
        .limit(perPage),
      Coupons.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCoupons / perPage);

    // Render the coupon page
    res.render("coupon", {
      coupons,
      currentPage: page,
      totalPages,
      perPage,
      search,
      status,
      validity,
      queryParams: `search=${encodeURIComponent(search)}&status=${status}&validity=${validity}`, // For pagination links
    });
  } catch (error) {
    console.error("Error rendering coupon page:", error);
    next(error);
  }
};

const addCoupon = async (req, res) => {
  try {
    let { code, offerPrice, minimumPrice, startOn, maxUses, maxUsesPerUser, expireOn } = req.body;

    if (!code || typeof code !== "string" || code.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Valid coupon code is required",
      });
    }

    if (maxUsesPerUser > maxUses) {
      return res.status(400).json({
        success: false,
        message: "Per-user limit cannot exceed total usage limit",
      });
    }

    code = code.trim().toUpperCase();

    const newCoupon = new Coupons({
      code,
      offerPrice: Number(offerPrice),
      minimumPrice: Number(minimumPrice),
      startOn: new Date(startOn),
      maxUses: Number(maxUses),
      maxUsesPerUser: Number(maxUsesPerUser),
      expireOn: new Date(expireOn),
      createdOn: new Date(),
      usesCount: 0,
      isListed: true,
      isDeleted: false,
    });

    await newCoupon.save();

    res.status(200).json({
      success: true,
      message: "Coupon created successfully",
    });
  } catch (error) {
    console.error("Error in addCoupon:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This coupon code already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//Coupon status toggle
const toggleCouponStatus = async (req, res) => {
  try {
    const { couponId } = req.params;
    const coupon = await Coupons.findById(couponId);
    
    // Don't allow toggling to listed if coupon is expired
    const today = new Date();
    const expireDate = new Date(coupon.expireOn);
    
    if (!coupon.isListed && expireDate < today) {
      return res.status(400).json({
        success: false,
        message: "Cannot list an expired coupon",
      });
    }

    const newStatus = !coupon.isListed;
    await Coupons.findByIdAndUpdate(couponId, { isListed: newStatus });
    
    res.status(200).json({
      success: true,
      message: `Coupon ${newStatus ? "listed" : "unlisted"} successfully`,
      isListed: newStatus,
    });
  } catch (error) {
    console.error("Error in toggleCouponStatus:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const editCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const { code, offerPrice, minimumPrice, startOn, maxUses, maxUsesPerUser, expireOn } = req.body;

    if (!code || typeof code !== "string" || code.trim() === "") {
      return res.status(400).json({ success: false, message: "Valid coupon code is required" });
    }

    const coupon = await Coupons.findById(couponId);
    if (maxUses < coupon.usesCount) {
      return res.status(400).json({
        success: false,
        message: "Total uses cannot be less than current uses count",
      });
    }

    if (maxUsesPerUser > maxUses) {
      return res.status(400).json({
        success: false,
        message: "Per-user limit cannot exceed total usage limit",
      });
    }

    const updatedCoupon = await Coupons.findByIdAndUpdate(
      couponId,
      {
        code: code.trim().toUpperCase(),
        offerPrice: Number(offerPrice),
        minimumPrice: Number(minimumPrice),
        startOn: new Date(startOn),
        maxUses: Number(maxUses),
        maxUsesPerUser: Number(maxUsesPerUser),
        expireOn: new Date(expireOn),
      },
      { new: true }
    );

    if (!updatedCoupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    res.status(200).json({ success: true, message: "Coupon updated successfully" });
  } catch (error) {
    console.error("Error in editCoupon:", error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "This coupon code already exists" });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const coupon = await Coupons.findByIdAndUpdate(couponId, { isDeleted: true }, { new: true });

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    res.status(200).json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteCoupon:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const coupon = await Coupons.findById(couponId);

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    res.status(200).json({
      success: true,
      coupon,
    });
  } catch (error) {
    console.error("Error in getCoupon:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getCouponPage,
  addCoupon,
  toggleCouponStatus,
  editCoupon,
  deleteCoupon,
  getCoupon,
};