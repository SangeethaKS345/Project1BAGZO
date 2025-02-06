const mongoose = required ("mongoose");
const {Schema} = mongoose;

const categorySchema = new mongoose.Schema({
    neme : {
        type : String,
        required : true,
        unique : true
    },
    description : {
        type : String,
        required : true,
    },
    isListed : {
        type : String,
        default : true
    },
    categoryOffer : {
        type : Number,
        default : 0
    },
    createdAt : {
        type : Date,
        default : Date.now
    }

})

const Category = mongoose.model("Category",categorySchema);

module.exports = Category;