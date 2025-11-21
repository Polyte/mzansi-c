const express = require('express');
const { body, validationResult } = require('express-validator');
const PromoCode = require('../models/PromoCode');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/promo/create
// @desc    Create a new promo code (Admin only)
// @access  Private (Admin)
router.post('/create', protect, authorize('admin'), [
  body('code').notEmpty().withMessage('Code is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('discountType').isIn(['percentage', 'fixed']).withMessage('Discount type must be percentage or fixed'),
  body('discountValue').isNumeric().withMessage('Discount value must be a number'),
  body('validFrom').isISO8601().withMessage('Valid from must be a valid date'),
  body('validUntil').isISO8601().withMessage('Valid until must be a valid date'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      code,
      description,
      discountType,
      discountValue,
      minFare,
      maxDiscount,
      validFrom,
      validUntil,
      usageLimit,
      applicableRideTypes
    } = req.body;

    const promo = await PromoCode.create({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      minFare: minFare || 0,
      maxDiscount: maxDiscount || null,
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      usageLimit: usageLimit || null,
      applicableRideTypes: applicableRideTypes || []
    });

    res.status(201).json(promo);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Promo code already exists' });
    }
    console.error('Create promo code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/promo/list
// @desc    Get all active promo codes (Admin only)
// @access  Private (Admin)
router.get('/list', protect, authorize('admin'), async (req, res) => {
  try {
    const promos = await PromoCode.find().sort({ createdAt: -1 });
    res.json(promos);
  } catch (error) {
    console.error('Get promo codes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/promo/active
// @desc    Get active promo codes (Public)
// @access  Public
router.get('/active', async (req, res) => {
  try {
    const now = new Date();
    const promos = await PromoCode.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $or: [
        { usageLimit: null },
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } }
      ]
    }).select('code description discountType discountValue minFare maxDiscount applicableRideTypes');

    res.json(promos);
  } catch (error) {
    console.error('Get active promo codes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

