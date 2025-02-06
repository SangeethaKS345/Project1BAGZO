const mongoose = require('mongoose');
const {Schema} = mongoose;
const {v4:uuidv4} = require('uuid');
const Address = require('./addressSchema');


const orderSchema = new Schema({
    orderId : {
        type: String,
        default : () => uuvid4(),
        unique : true
    },

    OrderItems : [{

        product : {
            type : Schema.Types.ObjectId,
            ref : 'Product',
            required : true
        },
        quantity : {
            type : Number,
            required : true
        },
        price : {
            type : Number,
            required : true
        },
        price : {
            type : Number,
            default : 0
        }
    }],

    totalPrice : {
        type : Number,
        default : 0
    },
    finalAmount : {
        type : Number,
        required : true
    },
    address : {
        type : Schema.Types.ObjectId,
        ref : "User",
        required : true
    },
    invoiceDate : {
        type : Date
    },
    status : {
        type : String,
        required : true,
        enum : ["Pending", "Processing", "Cancelled", "Return Request", "Returned"]
    },
    createdOn : {
        type : Date,
        default : true
    },

    couponApplied : {
        type : Boolean,
        default : false
    }
});


const Oeder = mongoose.model("Order",orderSchema);
module.exports = Order;