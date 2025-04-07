const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
  orderId: {
    type: String,
    required: true, 
    unique: true,
  },
  userId: {  
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
      required: true,
      get: v => Math.round(v), // Retrieve rounded value
      set: v => Math.round(v), // Store rounded value
    }
  }],
  couponCode: {
    type: String,
    default: null
  },
  discount: {
    type: Number,
    default: 0,
    get: v => Math.round(v), // Retrieve rounded value
    set: v => Math.round(v), // Store rounded value
  },
  totalPrice: {
    type: Number,
    default: 0,
    get: v => Math.round(v), // Retrieve rounded value
    set: v => Math.round(v), // Store rounded value
  },
  finalAmount: {
    type: Number,
    required: true,
    get: v => Math.round(v), // Retrieve rounded value
    set: v => Math.round(v), // Store rounded value
  },
  address: {
    type: Schema.Types.ObjectId,
    ref: 'Address',
    required: true
  },
  invoiceDate: {
    type: Date
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Failed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Request', 'Returned']
  },
  createdOn: {
    type: Date,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cod', 'razorpay', 'wallet'],
    default: 'cod'
  },
  paymentAttempts: {
    type: Number,
    default: 0,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  razorpayOrderId: {
    type: String,
    default: null,
  },
  returnReason: {
    type: String,
    default: null
  },
}, { toJSON: { getters: true } }); // Ensure getters are applied when converting to JSON

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);