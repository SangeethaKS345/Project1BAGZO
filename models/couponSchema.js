const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true,
  },
  startOn: {
    type: Date,
    required: true,
  },
  expireOn: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    default: "for mass sale",
  },
  offerPrice: {
    type: Number,
    required: true,
  },
  minimumPrice: {
    type: Number,
    required: true,
  },
  maxUses: {
    type: Number,
    required: true, // Total uses across all users
    min: 1,
  },
  maxUsesPerUser: {
    type: Number,
    required: true, // Maximum uses per user
    min: 1,
  },
  usesCount: {
    type: Number,
    default: 0,
  },
  userUses: [
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      count: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  ],
  isListed: {
    type: Boolean,
    default: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
});

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;