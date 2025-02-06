const mongoose = require("mongoose");
const Product = require("./productSchema");
const {Schema} = mongoose;

const wishlistSchema = new Schema({
    userId : {
        type : Schema.Types.ObjectId,
        ref : "User",
        required : true,
    },
    products : [{
        ProductId : {
            type : Schema.Types.ObjectId,
            ref : "Product",
            required : true
        },
        addedOn : {
            type : Date,
            default : Date.now
        }
    }]
})

const Wishlist = mongoose.model("Wishlist", wishlistSchema);

module.exports = Wishlist;