const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  rider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  pickupLocation: {
    address: String,
    latitude: Number,
    longitude: Number
  },
  dropoffLocation: {
    address: String,
    latitude: Number,
    longitude: Number
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'driver_arrived', 'in_progress', 'completed', 'cancelled'],
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
  rideType: {
    type: String,
    enum: ['economy', 'comfort', 'premium', 'xl'],
    default: 'economy'
  },
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
  driverLocation: {
    latitude: Number,
    longitude: Number,
    timestamp: Date
  },
  estimatedArrival: {
    type: Number,
    default: 0
  },
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  rating: {
    rider: {
      stars: Number,
      suggestions: [String], // e.g., ["Car was clean", "Driver was great company"]
      review: String
    },
    driver: {
      stars: Number,
      review: String
    }
  },
  recording: {
    enabled: {
      type: Boolean,
      default: false
    },
    startTime: Date,
    endTime: Date,
    audioUrl: String
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
  waypoints: [{
    address: String,
    latitude: Number,
    longitude: Number,
    order: Number
  }],
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
  },
  // Security Features
  verificationCode: {
    type: String,
    unique: true,
    sparse: true
  },
  isShared: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    contactId: String,
    name: String,
    phone: String,
    sharedAt: Date
  }],
  incidentReports: [{
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['safety', 'behavior', 'vehicle', 'payment', 'other']
    },
    description: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    reportedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved', 'dismissed'],
      default: 'pending'
    },
    adminNotes: String
  }],
  sosActivated: {
    type: Boolean,
    default: false
  },
  sosActivatedAt: Date,
  sosLocation: {
    latitude: Number,
    longitude: Number
  },
  sosContactsNotified: [{
    name: String,
    phone: String,
    notifiedAt: Date
  }],
  // Ride Pooling
  isPooled: {
    type: Boolean,
    default: false
  },
  poolRiders: [{
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    pickupLocation: {
      address: String,
      latitude: Number,
      longitude: Number
    },
    dropoffLocation: {
      address: String,
      latitude: Number,
      longitude: Number
    },
    fare: Number,
    joinedAt: Date
  }],
  // Split Fare
  splitFare: {
    enabled: {
      type: Boolean,
      default: false
    },
    participants: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      amount: Number,
      paid: {
        type: Boolean,
        default: false
      },
      paidAt: Date
    }],
    totalAmount: Number
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Ride', rideSchema);

