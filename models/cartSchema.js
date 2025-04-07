const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    products: [ 
        {
            productId: {
                type: Schema.Types.ObjectId,
                ref: "Product",
                required: true
            },
            quantity: {
                type: Number,
                default: 1
            },
            price: {
                type: Number,
                get: v => Math.round(v), // Retrieve rounded value
                set: v => Math.round(v), // Store rounded value
            },
            totalPrice: {
                type: Number,
                required: true,
                get: v => Math.round(v), // Retrieve rounded value
                set: v => Math.round(v), // Store rounded value
            },
            status: {
                type: String,
                default: "placed"
            },
            cancellationReason: {
                type: String,
                default: "none"
            }
        }
    ]
}, { toJSON: { getters: true } }); // Ensure getters are applied when converting to JSON

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;