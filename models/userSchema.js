const mongoose = require("mongoose");
const {Schema} = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    profileImage: {
        type: String,
        default: 'null' 
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
        sparse: true  // Allows multiple null values
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
    },
    redeemed: {
        type: Boolean,
        default: false
    },
}, { timestamps: true }); 



const User = mongoose.model("User", userSchema);

module.exports = User;

