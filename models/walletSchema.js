const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid'); // Add this line to import uuid

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  balance: {
    type: Number,
    default: 0,
    min: 0,
  },
  transactions: [{
    transactionId: {
      type: String,
      default: uuidv4,
      required: true
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
      required: true
    },
    description: {
      type: String,
    },
  }],
});

module.exports = mongoose.model("Wallet", walletSchema);