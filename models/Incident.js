const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  ride: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedAgainst: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['safety', 'behavior', 'vehicle', 'payment', 'fraud', 'other'],
    required: true
  },
  category: {
    type: String,
    enum: [
      'harassment',
      'unsafe_driving',
      'vehicle_condition',
      'payment_issue',
      'fraud',
      'cancellation',
      'route_deviation',
      'other'
    ]
  },
  description: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  location: {
    address: String,
    latitude: Number,
    longitude: Number
  },
  evidence: [{
    type: {
      type: String,
      enum: ['photo', 'video', 'audio', 'document']
    },
    url: String,
    description: String
  }],
  status: {
    type: String,
    enum: ['pending', 'investigating', 'resolved', 'dismissed', 'escalated'],
    default: 'pending'
  },
  adminNotes: String,
  resolution: String,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Incident', incidentSchema);

