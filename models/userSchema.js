const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    profileImage: {
        type: String,
        default: '/img/customers-icon-15.png' 
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        default: null
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    password: {
        type: String,
        required: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart",
        default: []
    }],
    referralCode: { 
        type: String, 
        unique: true, 
        sparse: true 
    }
   
}, { timestamps: true }); 

const User = mongoose.model("User", userSchema);
module.exports = User;