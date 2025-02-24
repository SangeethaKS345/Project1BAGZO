const mongoose = require("mongoose");
const { Schema } = mongoose;

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    isListed: {
        type: Boolean,  // Changed to Boolean type
        default: true   // Boolean true
    },
    categoryOffer: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });  // Moved timestamps to options object

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;