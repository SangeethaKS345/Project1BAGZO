
const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSequenceSchema = new Schema({
  date: { type: String, required: true }, 
  sequence: { type: Number, default: 0 },
});

module.exports = mongoose.model('OrderSequence', orderSequenceSchema);