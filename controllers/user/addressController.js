const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");

// Get Addresses
const getAddresses = async (req, res, next) => {
  try {
    console.log("Address page function called");

    const userId = req.session.user.id;
    const user = await User.findById(userId);
    const addresses = await Address.find({ userId });
    const error = req.session.error;
    req.session.error = null;

    console.log("Full user data:", user);
    console.log("Rendering address page");
    res.render("address", { addresses, user, error });
  } catch (error) {
    next(error);
  }
};

// Add Address Form
const addAddressForm = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const success = req.session.success || false;
    const error = req.session.error;
    req.session.success = false;
    req.session.error = null;

    res.render("addAddress", { user: req.session.user, userId, success, error });
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

    const requiredFields = { addressType, name, city, landMark, state, pincode, phone, altPhone };
    const emptyFields = Object.keys(requiredFields).filter(key => !requiredFields[key] || !requiredFields[key].toString().trim());

    if (emptyFields.length > 0) {
      console.log("Empty fields detected:", emptyFields);
      req.session.error = `Please fill out the following fields: ${emptyFields.join(", ")}`;
      return res.redirect("/address/new");
    }

    const phoneRegex = /^[1-9][0-9]{9}$/;
    if (!phoneRegex.test(phone) || phone === "0000000000") {
      console.log("Invalid phone number.");
      req.session.error = "Phone number must be a valid 10-digit number and cannot be all zeros.";
      return res.redirect("/address/new");
    }

    if (!phoneRegex.test(altPhone) || altPhone === "0000000000") {
      console.log("Invalid alternate phone number.");
      req.session.error = "Alternate phone number must be a valid 10-digit number and cannot be all zeros.";
      return res.redirect("/address/new");
    }

    if (phone === altPhone) {
      console.log("Phone and alternate phone cannot be the same.");
      req.session.error = "Phone and alternate phone numbers must be different.";
      return res.redirect("/address/new");
    }

    const newAddress = new Address({
      userId,
      addressType,
      name,
      city,
      landMark,
      state,
      pincode,
      phone,
      altPhone,
    });

    await newAddress.save();
    console.log("Address added successfully. Redirecting to address page...");

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

    const address = await Address.findOne({ _id: addressId, userId });

    if (!address) {
      console.log("Address not found.");
      return res.redirect("/address");
    }

    res.render("editAddress", { addressData: address, user: req.session.user });
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
      return res.status(400).render("/editAddress", {
        addressData: { _id: addressId, ...req.body },
        user: req.session.user,
        error: "All fields are required."
      });
    }

    const updatedAddress = await Address.findOneAndUpdate(
      { _id: addressId, userId },
      { addressType, name, city, landMark, state, pincode, phone, altPhone },
      { new: true, runValidators: true }
    );

    if (!updatedAddress) {
      console.log("Address update failed or address not found.");
      return res.status(404).render("/editAddress", {
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

    const deletedAddress = await Address.findOneAndDelete({ _id: addressId, userId });

    if (!deletedAddress) {
      req.session.error = "Address not found or could not be deleted.";
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    res.json({ success: true, message: "Address deleted successfully!" });
  } catch (error) {
    req.session.error = "An error occurred while deleting the address.";
    res.status(500).json({ success: false, message: "Server error" });
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