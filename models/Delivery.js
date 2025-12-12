const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  pickupLocation: {
    address: String,
    latitude: Number,
    longitude: Number
  },
  deliveryLocation: {
    address: String,
    latitude: Number,
    longitude: Number
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending'
  },
  fare: {
    type: Number,
    default: 0
  },
  distance: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 0
  },
  // Delivery-specific fields
  itemDescription: {
    type: String,
    required: true
  },
  itemWeight: {
    type: Number,
    default: 0 // in kg
  },
  itemValue: {
    type: Number,
    default: 0 // in Rands
  },
  deliveryType: {
    type: String,
    enum: ['standard', 'express', 'scheduled'],
    default: 'standard'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  specialInstructions: String,
  recipientName: String,
  recipientPhone: String,
  requiresSignature: {
    type: Boolean,
    default: false
  },
  photoProof: [{
    url: String,
    timestamp: Date,
    type: {
      type: String,
      enum: ['pickup', 'delivery', 'damage']
    }
  }],
  paymentMethod: {
    type: String,
    enum: ['card', 'cash', 'ewallet'],
    default: 'card'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  courierLocation: {
    latitude: Number,
    longitude: Number,
    timestamp: Date
  },
  estimatedArrival: {
    type: Number,
    default: 0
  },
  pickedUpAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  rating: {
    customer: {
      stars: Number,
      review: String
    },
    courier: {
      stars: Number,
      review: String
    }
  },
  shareCode: {
    type: String,
    unique: true,
    sparse: true
  },
  scheduledFor: {
    type: Date,
    default: null
  },
  isScheduled: {
    type: Boolean,
    default: false
  },
  promoCode: {
    type: String,
    default: null
  },
  discount: {
    type: Number,
    default: 0
  },
  finalFare: {
    type: Number,
    default: 0
  },
  receipt: {
    receiptNumber: String,
    generatedAt: Date,
    pdfUrl: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Delivery', deliverySchema);

