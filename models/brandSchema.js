const mongoose = require("mongoose");
const {Schema} = mongoose;


const brandSchema = new Schema({
   brandName: {
      type: String,
      required: true,
   },
   brandImage: {
      type: [String],  // Array of strings for multiple images
      required: true
   },
   isBlocked: {
      type: Boolean,
      default: false
   }
}, { timestamps: true });


const Brand  = mongoose.model("Brand", brandSchema);
module.exports = Brand;