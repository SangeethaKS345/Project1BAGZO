const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");

// Get Addresses
const getAddresses = async (req, res, next) => {
  try {
    console.log("Address page function called");

    const userId = req.session.user._id;
    const addressDoc = await Address.findOne({ userId });

    console.log("Rendering address page");
    res.render("address", { addressDoc, user: req.session.user });
  } catch (error) {
    next(error);
  }
};

// Add Address Form
const addAddressForm = async (req, res, next) => {
  try {
    const userId = req.session.user._id;

    res.render("addAddress", { user: req.session.user });
  } catch (error) {
    next(error);
  }
};

// Add Address
const addAddress = async (req, res, next) => {
  try {
    console.log("Add Address function called.");
    console.log("Request Body:", req.body);

    const userId = req.session.user._id;
    console.log("User ID:", userId);

    const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

    if (!addressType || !name || !city || !landMark || !state || !pincode || !phone || !altPhone) {
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
    
    return res.redirect("/address");
  } catch (error) {
    next(error);
  }
};

// Edit Address Form
const editAddressForm = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
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
    const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
    const addressId = req.params.id;

    const updatedAddress = await Address.updateOne(
      { "address._id": addressId },
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

    if (!updatedAddress.nModified) {
      console.log("Address update failed.");
      return res.redirect("/address");
    }

    res.redirect("/address");
  } catch (error) {
    next(error);
  }
};

// Delete Address
const deleteAddress = async (req, res, next) => {
  try {
    const addressId = req.params.id;

    const deletedAddress = await Address.updateOne(
      {},
      { $pull: { address: { _id: addressId } } }
    );

    if (!deletedAddress.nModified) {
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