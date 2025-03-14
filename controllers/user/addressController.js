const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");

// Get Addresses
const getAddresses = async (req, res, next) => {
  try {
    console.log("Address page function called");

    const userId = req.session.user.id;
    // Fetch full user data
    const user = await User.findById(userId);
    const addressDoc = await Address.findOne({ userId });

    console.log("Full user data:", user);
    console.log("Rendering address page");
    res.render("address", { addressDoc, user });
  } catch (error) {
    next(error);
  }
};

// Add Address Form
const addAddressForm = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const success = req.session.success;
    req.session.success = false; // reset the success flag

    res.render("addAddress", { user: req.session.user, userId: userId, success: success });
  } catch (error) {
    next(error);
  }
};

// Add Address
const addAddress = async (req, res, next) => {
  try {
    console.log("Add Address function called.");
    console.log("Request Body:", req.body);

    const userId = req.body.userId || req.session.user.id;
    console.log("User ID:", userId);

    const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

    if (!userId || !addressType || !name || !city || !landMark || !state || !pincode || !phone || !altPhone) {
      console.log("Missing required fields. Redirecting to add address page...");
      return res.redirect("/address/new");
    }

    const addressDoc = await Address.findOne({ userId });
    const newAddress = {
      addressType,
      name,
      city,
      landMark,
      state,
      pincode,
      phone,
      altPhone
    };

    if (addressDoc) {
      addressDoc.address.push(newAddress);
      await addressDoc.save();
    } else {
      await Address.create({
        userId,
        address: [newAddress]
      });
    }
    console.log("Address added successfully. Redirecting to address page...");

    // Set success flag
    req.session.success = true;
    return res.redirect("/address/new");
  } catch (error) {
    next(error);
  }
};

// Edit Address Form
const editAddressForm = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const addressId = req.params.id;

    const addressData = await Address.findOne({ userId, "address._id": addressId }, { "address.$": 1 });

    if (!addressData) {
      console.log("Address not found.");
      return res.redirect("/address");
    }

    res.render("editAddress", { addressData: addressData.address[0], user: req.session.user });
  } catch (error) {
    next(error);
  }
};

// Update Address
const updateAddress = async (req, res, next) => {
  try {
    console.log(`[${req.method}] Update route hit:`, req.params.id, req.body);
    const userId = req.session.user.id;
    const addressId = req.params.id;
    const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

    if (!addressType || !name || !city || !landMark || !state || !pincode || !phone || !altPhone) {
      console.log("Missing required fields.");
      return res.status(400).render("editAddress", {
        addressData: { _id: addressId, ...req.body },
        user: req.session.user,
        error: "All fields are required."
      });
    }

    const updatedAddress = await Address.updateOne(
      { userId, "address._id": addressId },
      {
        $set: {
          "address.$.addressType": addressType,
          "address.$.name": name,
          "address.$.city": city,
          "address.$.landMark": landMark,
          "address.$.state": state,
          "address.$.pincode": pincode,
          "address.$.phone": phone,
          "address.$.altPhone": altPhone
        }
      }
    );

    if (updatedAddress.nModified === 0) {
      console.log("Address update failed or address not found.");
      return res.status(404).render("editAddress", {
        addressData: { _id: addressId, ...req.body },
        user: req.session.user,
        error: "Address not found or no changes made."
      });
    }

    console.log("Address updated successfully.");
    req.session.success = true;
    res.redirect("/address");
  } catch (error) {
    next(error);
  }
};

// Delete Address
const deleteAddress = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const addressId = req.params.id;

    const updatedAddress = await Address.updateOne(
      { userId },
      { $pull: { address: { _id: addressId } } }
    );

    if (updatedAddress.nModified === 0) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    res.json({ success: true, message: "Address deleted successfully!" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAddresses,
  addAddressForm,
  addAddress,
  editAddressForm,
  updateAddress,
  deleteAddress,
};