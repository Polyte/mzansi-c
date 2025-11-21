const express = require('express');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    const user = await User.findById(req.user.id);

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (avatar) user.avatar = avatar;

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;
    res.json({ user: userObj });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/driver-info
// @desc    Update driver information
// @access  Private (Driver only)
router.put('/driver-info', protect, authorize('driver'), async (req, res) => {
  try {
    const {
      licenseNumber,
      licenseExpiry,
      licensePhoto,
      vehicleModel,
      vehicleMake,
      vehicleYear,
      vehicleColor,
      vehiclePlate,
      vehicleRegistration,
      vehicleRegistrationExpiry,
      insuranceProvider,
      insurancePolicyNumber,
      insuranceExpiry,
      vehiclePhoto
    } = req.body;
    
    const user = await User.findById(req.user.id);

    if (!user.driverInfo) {
      user.driverInfo = {};
    }

    // Update all provided fields
    if (licenseNumber !== undefined) user.driverInfo.licenseNumber = licenseNumber;
    if (licenseExpiry !== undefined) user.driverInfo.licenseExpiry = licenseExpiry;
    if (licensePhoto !== undefined) user.driverInfo.licensePhoto = licensePhoto;
    if (vehicleModel !== undefined) user.driverInfo.vehicleModel = vehicleModel;
    if (vehicleMake !== undefined) user.driverInfo.vehicleMake = vehicleMake;
    if (vehicleYear !== undefined) user.driverInfo.vehicleYear = vehicleYear;
    if (vehicleColor !== undefined) user.driverInfo.vehicleColor = vehicleColor;
    if (vehiclePlate !== undefined) user.driverInfo.vehiclePlate = vehiclePlate;
    if (vehicleRegistration !== undefined) user.driverInfo.vehicleRegistration = vehicleRegistration;
    if (vehicleRegistrationExpiry !== undefined) user.driverInfo.vehicleRegistrationExpiry = vehicleRegistrationExpiry;
    if (insuranceProvider !== undefined) user.driverInfo.insuranceProvider = insuranceProvider;
    if (insurancePolicyNumber !== undefined) user.driverInfo.insurancePolicyNumber = insurancePolicyNumber;
    if (insuranceExpiry !== undefined) user.driverInfo.insuranceExpiry = insuranceExpiry;
    if (vehiclePhoto !== undefined) user.driverInfo.vehiclePhoto = vehiclePhoto;

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;
    res.json(userObj);
  } catch (error) {
    console.error('Update driver info error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/driver-availability
// @desc    Update driver availability
// @access  Private (Driver only)
router.put('/driver-availability', protect, authorize('driver'), async (req, res) => {
  try {
    const { isAvailable, currentLocation } = req.body;
    const user = await User.findById(req.user.id);

    // Initialize driverInfo if it doesn't exist
    if (!user.driverInfo) {
      user.driverInfo = {};
    }

    if (typeof isAvailable === 'boolean') {
      user.driverInfo.isAvailable = isAvailable;
      
      // Auto-verify drivers for development (remove in production)
      if (isAvailable && !user.driverInfo.isVerified) {
        user.driverInfo.isVerified = true;
        console.log(`Auto-verified driver ${user._id} for development`);
      }
    }

    if (currentLocation) {
      user.driverInfo.currentLocation = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
      };
    }

    await user.save();

    console.log(`Driver ${user._id} availability updated:`, {
      isAvailable: user.driverInfo.isAvailable,
      isVerified: user.driverInfo.isVerified,
      hasLocation: !!user.driverInfo.currentLocation
    });

    res.json(user);
  } catch (error) {
    console.error('Update driver availability error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/nearby-drivers
// @desc    Get nearby available drivers
// @access  Private
router.get('/nearby-drivers', protect, async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query; // radius in km

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    // Find available drivers
    const drivers = await User.find({
      isDriver: true,
      'driverInfo.isAvailable': true,
      'driverInfo.currentLocation': { $exists: true }
    }).select('name driverInfo');

    // Filter by distance
    const nearbyDrivers = drivers.filter(driver => {
      if (!driver.driverInfo?.currentLocation) return false;
      
      const driverLat = driver.driverInfo.currentLocation.latitude;
      const driverLng = driver.driverInfo.currentLocation.longitude;
      
      // Haversine formula to calculate distance
      const R = 6371; // Earth's radius in km
      const dLat = (driverLat - parseFloat(latitude)) * Math.PI / 180;
      const dLng = (driverLng - parseFloat(longitude)) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(parseFloat(latitude) * Math.PI / 180) * Math.cos(driverLat * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      return distance <= parseFloat(radius);
    }).map(driver => ({
      id: driver._id,
      name: driver.name,
      location: driver.driverInfo.currentLocation,
      rating: driver.driverInfo.rating || 0,
      vehicleModel: driver.driverInfo.vehicleModel,
      vehicleColor: driver.driverInfo.vehicleColor
    }));

    res.json(nearbyDrivers);
  } catch (error) {
    console.error('Get nearby drivers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/saved-places
// @desc    Get user's saved places
// @access  Private
router.get('/saved-places', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('savedPlaces');
    res.json(user.savedPlaces || []);
  } catch (error) {
    console.error('Get saved places error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/saved-places
// @desc    Add a saved place
// @access  Private
router.post('/saved-places', protect, async (req, res) => {
  try {
    const { name, address, latitude, longitude, type } = req.body;

    if (!name || !latitude || !longitude) {
      return res.status(400).json({ message: 'Name, latitude, and longitude are required' });
    }

    const user = await User.findById(req.user.id);

    // Check if home or work already exists (only one allowed)
    if (type === 'home' || type === 'work') {
      const existingIndex = user.savedPlaces.findIndex(p => p.type === type);
      if (existingIndex !== -1) {
        user.savedPlaces[existingIndex] = {
          name,
          address,
          latitude,
          longitude,
          type
        };
      } else {
        user.savedPlaces.push({
          name,
          address,
          latitude,
          longitude,
          type: type || 'favorite'
        });
      }
    } else {
      user.savedPlaces.push({
        name,
        address,
        latitude,
        longitude,
        type: type || 'favorite'
      });
    }

    await user.save();
    res.json(user.savedPlaces);
  } catch (error) {
    console.error('Add saved place error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/saved-places/:id
// @desc    Delete a saved place
// @access  Private
router.delete('/saved-places/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.savedPlaces = user.savedPlaces.filter(
      place => place._id.toString() !== req.params.id
    );
    await user.save();
    res.json({ message: 'Saved place deleted', savedPlaces: user.savedPlaces });
  } catch (error) {
    console.error('Delete saved place error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/payment-methods
// @desc    Get user's payment methods
// @access  Private
router.get('/payment-methods', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('paymentMethods');
    res.json(user.paymentMethods || []);
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/payment-methods
// @desc    Add a payment method
// @access  Private
router.post('/payment-methods', protect, async (req, res) => {
  try {
    const { type, cardNumber, cardHolderName, expiryMonth, expiryYear, cvv, walletProvider, phoneNumber, isDefault } = req.body;

    if (!type) {
      return res.status(400).json({ message: 'Payment method type is required' });
    }

    const user = await User.findById(req.user.id);

    // If setting as default, unset other defaults
    if (isDefault) {
      user.paymentMethods.forEach(pm => {
        pm.isDefault = false;
      });
    }

    let paymentMethod = {
      type,
      isDefault: isDefault || false
    };

    if (type === 'card') {
      if (!cardNumber || !cardHolderName || !expiryMonth || !expiryYear) {
        return res.status(400).json({ message: 'Card details are required' });
      }

      // Extract last 4 digits
      const last4 = cardNumber.replace(/\s/g, '').slice(-4);
      
      // Determine card brand (simplified - in production use proper card validation)
      let brand = 'Unknown';
      const firstDigit = cardNumber.replace(/\s/g, '')[0];
      if (firstDigit === '4') brand = 'Visa';
      else if (firstDigit === '5') brand = 'Mastercard';
      else if (firstDigit === '3') brand = 'Amex';

      // In production, never store full card numbers or CVV
      // Use a payment processor like Stripe to tokenize cards
      paymentMethod.last4 = last4;
      paymentMethod.brand = brand;
      paymentMethod.cardHolderName = cardHolderName;
      paymentMethod.expiryMonth = expiryMonth;
      paymentMethod.expiryYear = expiryYear;
    } else if (type === 'ewallet') {
      paymentMethod.walletProvider = walletProvider || 'Unknown';
      paymentMethod.phoneNumber = phoneNumber;
    }

    user.paymentMethods.push(paymentMethod);
    await user.save();

    res.json({
      message: 'Payment method added successfully',
      paymentMethods: user.paymentMethods
    });
  } catch (error) {
    console.error('Add payment method error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/payment-methods/:id
// @desc    Update a payment method
// @access  Private
router.put('/payment-methods/:id', protect, async (req, res) => {
  try {
    const { cardHolderName, expiryMonth, expiryYear, isDefault, walletProvider, phoneNumber } = req.body;

    const user = await User.findById(req.user.id);
    const paymentMethod = user.paymentMethods.id(req.params.id);

    if (!paymentMethod) {
      return res.status(404).json({ message: 'Payment method not found' });
    }

    if (paymentMethod.type === 'card') {
      if (cardHolderName) paymentMethod.cardHolderName = cardHolderName;
      if (expiryMonth) paymentMethod.expiryMonth = expiryMonth;
      if (expiryYear) paymentMethod.expiryYear = expiryYear;
    } else if (paymentMethod.type === 'ewallet') {
      if (walletProvider) paymentMethod.walletProvider = walletProvider;
      if (phoneNumber) paymentMethod.phoneNumber = phoneNumber;
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      user.paymentMethods.forEach(pm => {
        if (pm._id.toString() !== req.params.id) {
          pm.isDefault = false;
        }
      });
      paymentMethod.isDefault = true;
    }

    await user.save();

    res.json({
      message: 'Payment method updated successfully',
      paymentMethods: user.paymentMethods
    });
  } catch (error) {
    console.error('Update payment method error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/payment-methods/:id
// @desc    Delete a payment method
// @access  Private
router.delete('/payment-methods/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.paymentMethods = user.paymentMethods.filter(
      pm => pm._id.toString() !== req.params.id
    );
    await user.save();

    res.json({
      message: 'Payment method deleted successfully',
      paymentMethods: user.paymentMethods
    });
  } catch (error) {
    console.error('Delete payment method error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========== BANKING DETAILS ROUTES (FOR DRIVERS) ==========

// @route   GET /api/users/banking-details
// @desc    Get user's banking details
// @access  Private (Driver only)
router.get('/banking-details', protect, authorize('driver'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('bankingDetails');
    res.json(user.bankingDetails || []);
  } catch (error) {
    console.error('Get banking details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/banking-details
// @desc    Add banking details
// @access  Private (Driver only)
router.post('/banking-details', protect, authorize('driver'), async (req, res) => {
  try {
    const { bankName, accountHolderName, accountNumber, accountType, branchCode, swiftCode, isDefault } = req.body;

    if (!bankName || !accountHolderName || !accountNumber) {
      return res.status(400).json({ message: 'Bank name, account holder name, and account number are required' });
    }

    const user = await User.findById(req.user.id);

    // If setting as default, unset other defaults
    if (isDefault) {
      user.bankingDetails.forEach(bd => {
        bd.isDefault = false;
      });
    }

    const bankingDetail = {
      bankName,
      accountHolderName,
      accountNumber,
      accountType: accountType || 'checking',
      branchCode: branchCode || '',
      swiftCode: swiftCode || '',
      isDefault: isDefault || false
    };

    user.bankingDetails.push(bankingDetail);
    await user.save();

    res.json({
      message: 'Banking details added successfully',
      bankingDetails: user.bankingDetails
    });
  } catch (error) {
    console.error('Add banking details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/banking-details/:id
// @desc    Update banking details
// @access  Private (Driver only)
router.put('/banking-details/:id', protect, authorize('driver'), async (req, res) => {
  try {
    const { bankName, accountHolderName, accountNumber, accountType, branchCode, swiftCode, isDefault } = req.body;

    const user = await User.findById(req.user.id);
    const bankingDetail = user.bankingDetails.id(req.params.id);

    if (!bankingDetail) {
      return res.status(404).json({ message: 'Banking details not found' });
    }

    if (bankName) bankingDetail.bankName = bankName;
    if (accountHolderName) bankingDetail.accountHolderName = accountHolderName;
    if (accountNumber) bankingDetail.accountNumber = accountNumber;
    if (accountType) bankingDetail.accountType = accountType;
    if (branchCode !== undefined) bankingDetail.branchCode = branchCode;
    if (swiftCode !== undefined) bankingDetail.swiftCode = swiftCode;

    // If setting as default, unset other defaults
    if (isDefault !== undefined && isDefault) {
      user.bankingDetails.forEach(bd => {
        if (bd._id.toString() !== req.params.id) {
          bd.isDefault = false;
        }
      });
      bankingDetail.isDefault = true;
    }

    await user.save();

    res.json({
      message: 'Banking details updated successfully',
      bankingDetails: user.bankingDetails
    });
  } catch (error) {
    console.error('Update banking details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/banking-details/:id
// @desc    Delete banking details
// @access  Private (Driver only)
router.delete('/banking-details/:id', protect, authorize('driver'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.bankingDetails = user.bankingDetails.filter(
      bd => bd._id.toString() !== req.params.id
    );
    await user.save();

    res.json({
      message: 'Banking details deleted successfully',
      bankingDetails: user.bankingDetails
    });
  } catch (error) {
    console.error('Delete banking details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

