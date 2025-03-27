const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");

const getAddresses = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const user = await User.findById(userId);
    const addresses = await Address.find({ userId });
    const error = req.session.error;
    req.session.error = null;

    res.render("address", { addresses, user, error });
  } catch (error) {
    next(error);
  }
};

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
    const emptyFields = Object.keys(requiredFields).filter(key => !requiredFields[key]?.toString().trim());

    if (emptyFields.length > 0) {
      req.session.error = `Please fill out: ${emptyFields.join(", ")}`;
      return res.redirect("/address/new");
    }

    const textOnlyRegex = /^[A-Za-z\s]+$/;
    if (!textOnlyRegex.test(name)) {
      req.session.error = "Name must contain only letters and spaces.";
      return res.redirect("/address/new");
    }
    if (!textOnlyRegex.test(city)) {
      req.session.error = "City must contain only letters and spaces.";
      return res.redirect("/address/new");
    }
    if (!textOnlyRegex.test(state)) {
      req.session.error = "State must contain only letters and spaces.";
      return res.redirect("/address/new");
    }

    const phoneRegex = /^[1-9][0-9]{9}$/;
    if (!phoneRegex.test(phone)) {
      req.session.error = "Invalid phone number format.";
      return res.redirect("/address/new");
    }
    if (!phoneRegex.test(altPhone) || phone === altPhone) {
      req.session.error = "Invalid alternate phone or same as primary phone.";
      return res.redirect("/address/new");
    }

    if (!/^[1-9][0-9]{5}$/.test(pincode)) {
      req.session.error = "Pincode must be a valid 6-digit number.";
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

const updateAddress = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const addressId = req.params.id;
    const { addressType, name, houseNo, city, landMark, state, pincode, phone, altPhone } = req.body;

    const updateData = {};
    if (addressType) updateData.addressType = addressType;
    if (name) updateData.name = name;
    if (houseNo) updateData.houseNo = houseNo;
    if (city) updateData.city = city;
    if (landMark) updateData.landMark = landMark;
    if (state) updateData.state = state;
    if (pincode) updateData.pincode = pincode;
    if (phone) updateData.phone = phone;
    if (altPhone) updateData.altPhone = altPhone;

    const textOnlyRegex = /^[A-Za-z\s]+$/;
    if (name && !textOnlyRegex.test(name)) {
      req.session.error = "Name must contain only letters and spaces.";
      return res.redirect(`/address/edit/${addressId}`);
    }
    if (city && !textOnlyRegex.test(city)) {
      req.session.error = "City must contain only letters and spaces.";
      return res.redirect(`/address/edit/${addressId}`);
    }
    if (state && !textOnlyRegex.test(state)) {
      req.session.error = "State must contain only letters and spaces.";
      return res.redirect(`/address/edit/${addressId}`);
    }

    const phoneRegex = /^[1-9][0-9]{9}$/;
    if (phone && !phoneRegex.test(phone)) {
      req.session.error = "Invalid phone number format.";
      return res.redirect(`/address/edit/${addressId}`);
    }
    if (altPhone && (!phoneRegex.test(altPhone) || phone === altPhone)) {
      req.session.error = "Invalid alternate phone or same as primary phone.";
      return res.redirect(`/address/edit/${addressId}`);
    }

    if (pincode && !/^[1-9][0-9]{5}$/.test(pincode)) {
      req.session.error = "Pincode must be a valid 6-digit number.";
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

module.exports = {
  getAddresses,
  addAddressForm,
  addAddress,
  editAddressForm,
  updateAddress,
  deleteAddress,
};