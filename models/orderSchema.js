const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');
const Address = require('./addressSchema');

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: () => uuidv4(),  
        unique: true
    },

    OrderItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,  
            required: true
        }
    }],

    totalPrice: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true
    },
    address: {
        type: Schema.Types.ObjectId,
        ref: "Address",  // ✅ Changed ref to Address
        required: true
    },
    invoiceDate: {
        type: Date
    },
    status: {
        type: String,
        required: true,
        enum: ["Pending", "Processing", "Cancelled", "Return Request", "Returned"]
    },
    createdOn: {
        type: Date,
        default: Date.now  // ✅ Fixed default value
    },

    couponApplied: {
        type: Boolean,
        default: false
    }
});


const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
