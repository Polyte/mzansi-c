const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['rider', 'driver', 'admin'],
    default: 'rider'
  },
  avatar: {
    type: String,
    default: ''
  },
  isDriver: {
    type: Boolean,
    default: false
  },
  // Verification fields for riders
  verification: {
    emailVerified: {
      type: Boolean,
      default: false
    },
    phoneVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationCode: String,
    emailVerificationCodeExpiry: Date,
    phoneVerificationCode: String,
    phoneVerificationCodeExpiry: Date,
    verifiedAt: Date
  },
  driverInfo: {
    licenseNumber: String,
    licenseExpiry: Date,
    licensePhoto: String, // URL to license photo
    vehicleModel: String,
    vehicleMake: String, // e.g., Toyota, BMW
    vehicleYear: String,
    vehicleColor: String,
    vehiclePlate: String,
    vehicleRegistration: String, // Registration number
    vehicleRegistrationExpiry: Date,
    insuranceProvider: String,
    insurancePolicyNumber: String,
    insuranceExpiry: Date,
    vehiclePhoto: String, // URL to vehicle photo
    isVerified: {
      type: Boolean,
      default: false
    },
    isAvailable: {
      type: Boolean,
      default: false
    },
    currentLocation: {
      latitude: Number,
      longitude: Number
    },
    rating: {
      type: Number,
      default: 0
    },
    totalRides: {
      type: Number,
      default: 0
    }
  },
  rating: {
    type: Number,
    default: 0
  },
  totalRides: {
    type: Number,
    default: 0
  },
  paymentMethods: [{
    type: {
      type: String,
      enum: ['card', 'cash', 'ewallet'],
      required: true
    },
    last4: String,
    brand: String,
    cardHolderName: String,
    expiryMonth: String,
    expiryYear: String,
    isDefault: {
      type: Boolean,
      default: false
    },
    walletProvider: String, // For eWallet (e.g., 'PayPal', 'Apple Pay', etc.)
    phoneNumber: String // For eWallet that uses phone numbers
  }],
  // Favorite/Saved Locations
  favoriteLocations: [{
    name: {
      type: String,
      required: true
    },
    address: String,
    latitude: Number,
    longitude: Number,
    type: {
      type: String,
      enum: ['home', 'work', 'favorite', 'other'],
      default: 'favorite'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Ride Preferences
  ridePreferences: {
    music: {
      type: String,
      enum: ['none', 'quiet', 'moderate', 'loud'],
      default: 'moderate'
    },
    temperature: {
      type: String,
      enum: ['cool', 'moderate', 'warm'],
      default: 'moderate'
    },
    conversation: {
      type: String,
      enum: ['none', 'minimal', 'moderate', 'friendly'],
      default: 'moderate'
    },
    accessibility: {
      wheelchairAccessible: {
        type: Boolean,
        default: false
      },
      assistanceNeeded: {
        type: Boolean,
        default: false
      }
    }
  },
  emergencyContacts: {
    emergency: {
      type: String,
      default: '112'
    },
    police: {
      type: String,
      default: '10111'
    },
    fire: {
      type: String,
      default: '10177'
    }
  },
  savedPlaces: [{
    name: {
      type: String,
      required: true
    },
    address: String,
    latitude: Number,
    longitude: Number,
    type: {
      type: String,
      enum: ['home', 'work', 'favorite'],
      default: 'favorite'
    }
  }],
  bankingDetails: [{
    bankName: {
      type: String,
      required: true
    },
    accountHolderName: {
      type: String,
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    accountType: {
      type: String,
      enum: ['checking', 'savings'],
      default: 'checking'
    },
    branchCode: String,
    swiftCode: String,
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  // Security Features
  security: {
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: String,
    biometricEnabled: {
      type: Boolean,
      default: false
    },
    lastLoginIP: String,
    lastLoginDevice: String,
    lastLoginTime: Date,
    loginHistory: [{
      ip: String,
      device: String,
      location: String,
      timestamp: Date
    }],
    suspiciousActivity: [{
      type: String,
      description: String,
      timestamp: Date,
      resolved: {
        type: Boolean,
        default: false
      }
    }]
  },
  // Trusted Contacts for Trip Sharing
  trustedContacts: [{
    name: String,
    phone: String,
    email: String,
    relationship: String, // family, friend, etc.
    canTrackTrips: {
      type: Boolean,
      default: true
    }
  }],
  // Loyalty Program
  loyalty: {
    points: {
      type: Number,
      default: 0
    },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze'
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    rewardsRedeemed: [{
      rewardId: String,
      rewardName: String,
      pointsUsed: Number,
      redeemedAt: Date
    }]
  },
  // Favorite Drivers
  favoriteDrivers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Blocked Users
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    reason: String,
    blockedAt: Date
  }]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

