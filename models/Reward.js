const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['discount', 'free_ride', 'points_bonus', 'upgrade'],
    required: true
  },
  pointsCost: {
    type: Number,
    default: 0
  },
  discountAmount: Number,
  discountPercentage: Number,
  maxUses: Number,
  usedCount: {
    type: Number,
    default: 0
  },
  validFrom: Date,
  validUntil: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  minTier: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum'],
    default: 'bronze'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Reward', rewardSchema);

