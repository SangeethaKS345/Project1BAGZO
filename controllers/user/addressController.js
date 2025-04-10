const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");

// Load Address Page
const getAddresses = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const [user, addresses] = await Promise.all([
      User.findById(userId),
      Address.find({ userId })
    ]);
    const error = req.session.error;
    req.session.error = null;

    res.render("address", { addresses, user, error });
  } catch (error) {
    next(error);
  }
};

// Load Add Address Form
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
    const userId = req.body.userId || req.session.user.id;
    const addressCount = await Address.countDocuments({ userId });
    
    if (addressCount >= 3) {
      req.session.error = "Maximum address limit (3) reached.";
      return res.redirect("/address/new");
    }

    const { addressType, name, houseNo, city, landMark, state, pincode, phone, altPhone } = req.body;

    const requiredFields = { addressType, name, houseNo, city, landMark, state, pincode, phone, altPhone };
    const emptyFields = validateRequiredFields(requiredFields);

    if (emptyFields.length > 0) {
      req.session.error = `Please fill out: ${emptyFields.join(", ")}`;
      return res.redirect("/address/new");
    }

    const validationErrors = validateFields({ name, city, state, phone, altPhone, pincode });
    if (validationErrors.length > 0) {
      req.session.error = validationErrors.join(" ");
      return res.redirect("/address/new");
    }

    const newAddress = new Address({
      userId,
      addressType,
      name,
      houseNo,
      city,
      landMark,
      state,
      pincode,
      phone,
      altPhone,
    });

    await newAddress.save();
    req.session.success = true;
    return res.redirect("/address/new");
  } catch (error) {
    next(error);
  }
};

// Load Edit Address Form
const editAddressForm = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const addressId = req.params.id;
    const address = await Address.findOne({ _id: addressId, userId });

    if (!address) {
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
    const userId = req.session.user.id;
    const addressId = req.params.id;
    const { addressType, name, houseNo, city, landMark, state, pincode, phone, altPhone } = req.body;

    const updateData = createUpdateData({ addressType, name, houseNo, city, landMark, state, pincode, phone, altPhone });

    const validationErrors = validateFields({ name, city, state, phone, altPhone, pincode });
    if (validationErrors.length > 0) {
      req.session.error = validationErrors.join(" ");
      return res.redirect(`/address/edit/${addressId}`);
    }

    const updatedAddress = await Address.findOneAndUpdate(
      { _id: addressId, userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedAddress) {
      req.session.error = "Address not found.";
      return res.redirect("/address");
    }

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
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    res.json({ success: true, message: "Address deleted successfully!" });
  } catch (error) {
    next(error);
  }
};

// Helper Functions
const validateRequiredFields = (fields) => {
  return Object.keys(fields).filter(key => !fields[key]?.toString().trim());
};

const validateFields = ({ name, city, state, phone, altPhone, pincode }) => {
  const textOnlyRegex = /^[A-Za-z\s]+$/;
  const phoneRegex = /^[1-9][0-9]{9}$/;
  const pincodeRegex = /^[1-9][0-9]{5}$/;
  const errors = [];

  if (name && !textOnlyRegex.test(name)) {
    errors.push("Name must contain only letters and spaces.");
  }
  if (city && !textOnlyRegex.test(city)) {
    errors.push("City must contain only letters and spaces.");
  }
  if (state && !textOnlyRegex.test(state)) {
    errors.push("State must contain only letters and spaces.");
  }
  if (phone && !phoneRegex.test(phone)) {
    errors.push("Invalid phone number format.");
  }
  if (altPhone && (!phoneRegex.test(altPhone) || phone === altPhone)) {
    errors.push("Invalid alternate phone or same as primary phone.");
  }
  if (pincode && !pincodeRegex.test(pincode)) {
    errors.push("Pincode must be a valid 6-digit number.");
  }

  return errors;
};

const createUpdateData = (fields) => {
  const updateData = {};
  Object.keys(fields).forEach(key => {
    if (fields[key]) updateData[key] = fields[key];
  });
  return updateData;
};

module.exports = {
  getAddresses,
  addAddressForm,
  addAddress,
  editAddressForm,
  updateAddress,
  deleteAddress,
};