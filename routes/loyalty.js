const express = require('express');
const User = require('../models/User');
const Reward = require('../models/Reward');
const Ride = require('../models/Ride');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Calculate loyalty points (1 point per R1 spent)
const POINTS_PER_RAND = 1;
const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 1000,
  gold: 5000,
  platinum: 10000
};

// @route   GET /api/loyalty/points
// @desc    Get user's loyalty points and tier
// @access  Private
router.get('/points', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user.loyalty) {
      user.loyalty = {
        points: 0,
        tier: 'bronze',
        totalSpent: 0,
        rewardsRedeemed: []
      };
      await user.save();
    }

    res.json({
      points: user.loyalty.points,
      tier: user.loyalty.tier,
      totalSpent: user.loyalty.totalSpent,
      nextTier: getNextTier(user.loyalty.tier),
      pointsToNextTier: getPointsToNextTier(user.loyalty.tier, user.loyalty.points)
    });
  } catch (error) {
    console.error('Get loyalty points error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/loyalty/rewards
// @desc    Get available rewards
// @access  Private
router.get('/rewards', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const userTier = user.loyalty?.tier || 'bronze';

    const rewards = await Reward.find({
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
      $or: [
        { minTier: 'bronze' },
        { minTier: userTier === 'silver' ? 'silver' : null },
        { minTier: userTier === 'gold' ? 'gold' : null },
        { minTier: userTier === 'platinum' ? 'platinum' : null }
      ]
    }).sort({ pointsCost: 1 });

    res.json(rewards);
  } catch (error) {
    console.error('Get rewards error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/loyalty/redeem
// @desc    Redeem a reward
// @access  Private
router.post('/redeem', protect, async (req, res) => {
  try {
    const { rewardId } = req.body;

    if (!rewardId) {
      return res.status(400).json({ message: 'Reward ID is required' });
    }

    const user = await User.findById(req.user.id);
    const reward = await Reward.findById(rewardId);

    if (!reward) {
      return res.status(404).json({ message: 'Reward not found' });
    }

    if (!reward.isActive) {
      return res.status(400).json({ message: 'Reward is not active' });
    }

    if (reward.maxUses && reward.usedCount >= reward.maxUses) {
      return res.status(400).json({ message: 'Reward has reached maximum uses' });
    }

    if (user.loyalty.points < reward.pointsCost) {
      return res.status(400).json({ message: 'Insufficient points' });
    }

    // Check tier requirement
    const userTier = user.loyalty.tier;
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
    if (tierOrder.indexOf(userTier) < tierOrder.indexOf(reward.minTier)) {
      return res.status(400).json({ message: 'Tier requirement not met' });
    }

    // Deduct points
    user.loyalty.points -= reward.pointsCost;
    user.loyalty.rewardsRedeemed.push({
      rewardId: reward._id,
      rewardName: reward.name,
      pointsUsed: reward.pointsCost,
      redeemedAt: new Date()
    });

    // Update reward usage
    reward.usedCount += 1;
    await reward.save();
    await user.save();

    res.json({
      message: 'Reward redeemed successfully',
      reward: reward.toObject(),
      remainingPoints: user.loyalty.points
    });
  } catch (error) {
    console.error('Redeem reward error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to award points after ride completion
async function awardLoyaltyPoints(userId, amount) {
  try {
    const user = await User.findById(userId);
    
    if (!user.loyalty) {
      user.loyalty = {
        points: 0,
        tier: 'bronze',
        totalSpent: 0,
        rewardsRedeemed: []
      };
    }

    const pointsEarned = Math.floor(amount * POINTS_PER_RAND);
    user.loyalty.points += pointsEarned;
    user.loyalty.totalSpent += amount;

    // Update tier
    const newTier = calculateTier(user.loyalty.totalSpent);
    user.loyalty.tier = newTier;

    await user.save();
    return { pointsEarned, newTier };
  } catch (error) {
    console.error('Award loyalty points error:', error);
    return null;
  }
}

function calculateTier(totalSpent) {
  if (totalSpent >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (totalSpent >= TIER_THRESHOLDS.gold) return 'gold';
  if (totalSpent >= TIER_THRESHOLDS.silver) return 'silver';
  return 'bronze';
}

function getNextTier(currentTier) {
  const tiers = ['bronze', 'silver', 'gold', 'platinum'];
  const currentIndex = tiers.indexOf(currentTier);
  return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
}

function getPointsToNextTier(currentTier, currentPoints) {
  const nextTier = getNextTier(currentTier);
  if (!nextTier) return 0;
  
  const currentThreshold = TIER_THRESHOLDS[currentTier] || 0;
  const nextThreshold = TIER_THRESHOLDS[nextTier];
  const pointsNeeded = (nextThreshold - currentThreshold) * POINTS_PER_RAND;
  
  return Math.max(0, pointsNeeded - (currentPoints - (currentThreshold * POINTS_PER_RAND)));
}

module.exports = { router, awardLoyaltyPoints };

