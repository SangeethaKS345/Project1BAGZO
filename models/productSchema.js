const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
    productName: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true, 
    },
    brand: {
        type: Schema.Types.ObjectId,
        ref: 'Brand',
        required: true, 
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    regularPrice: {
        type: Number,
        required: true,
        get: v => Math.round(v),
        set: v => Math.round(v),
    },
    salesPrice: {
        type: Number,
        required: true,
        get: v => Math.round(v),
        set: v => Math.round(v),
    },
    productOffer: {
        type: Number,
        default: 0,
        get: v => Math.round(v),
        set: v => Math.round(v),
    },
    offerEndDate: {  
        type: Date,
        default: null
    },
    quantity: {
        type: Number,
        default: 0,
        min: 0
    },
    color: {
        type: String,
        required: true,
    },
    productImage: {
        type: [String],
        required: true
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: ["Available", "Out of Stock", "Discontinued"],
        default: "Available",
    }, 
    createdOn: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true, toJSON: { getters: true } });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;