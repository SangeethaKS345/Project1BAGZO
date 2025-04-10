const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  addressType: {
    type: String,
    required: true,
    enum: ['Home', 'Work', 'Other']
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2
  },
  houseNo: {  
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  landMark: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  pincode: {
    type: Number,
    required: true,
    min: 100000,
    max: 999999
  },
  phone: {
    type: String,
    required: true,
    match: /^[1-9][0-9]{9}$/
  },
  altPhone: {
    type: String,
    required: true,
    match: /^[1-9][0-9]{9}$/
  },
});

const Address = mongoose.model("Address", addressSchema);
module.exports = Address;