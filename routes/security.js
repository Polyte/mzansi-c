const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Incident = require('../models/Incident');
const { protect } = require('../middleware/auth');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const router = express.Router();

// @route   POST /api/security/sos
// @desc    Activate SOS/Emergency button
// @access  Private
router.post('/sos', protect, async (req, res) => {
  try {
    const { rideId, location } = req.body;
    
    if (!rideId) {
      return res.status(400).json({ message: 'Ride ID is required' });
    }

    const ride = await Ride.findById(rideId)
      .populate('rider', 'name phone emergencyContacts trustedContacts')
      .populate('driver', 'name phone');

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    // Check if user is part of this ride
    const isRider = ride.rider._id.toString() === req.user.id;
    const isDriver = ride.driver && ride.driver._id.toString() === req.user.id;

    if (!isRider && !isDriver) {
      return res.status(403).json({ message: 'Not authorized for this ride' });
    }

    // Activate SOS
    ride.sosActivated = true;
    ride.sosActivatedAt = new Date();
    if (location) {
      ride.sosLocation = location;
    }

    // Notify emergency contacts
    const user = await User.findById(req.user.id);
    const emergencyContacts = user.emergencyContacts || {};
    const trustedContacts = user.trustedContacts || [];
    
    const contactsToNotify = [
      { name: 'Emergency Services', phone: emergencyContacts.emergency || '112' },
      { name: 'Police', phone: emergencyContacts.police || '10111' },
      ...trustedContacts.filter(tc => tc.canTrackTrips).map(tc => ({
        name: tc.name,
        phone: tc.phone
      }))
    ];

    ride.sosContactsNotified = contactsToNotify.map(contact => ({
      name: contact.name,
      phone: contact.phone,
      notifiedAt: new Date()
    }));

    await ride.save();

    // Emit SOS event via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`ride-${rideId}`).emit('sos-activated', {
        rideId,
        location: ride.sosLocation,
        activatedBy: req.user.id,
        timestamp: ride.sosActivatedAt
      });
      
      // Notify admin
      io.to('admin').emit('sos-alert', {
        rideId,
        ride: ride.toObject(),
        location: ride.sosLocation,
        activatedBy: req.user.id
      });
    }

    res.json({
      message: 'SOS activated. Emergency contacts have been notified.',
      ride: ride.toObject()
    });
  } catch (error) {
    console.error('SOS activation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/security/incident
// @desc    Report an incident
// @access  Private
router.post('/incident', protect, [
  body('rideId').notEmpty().withMessage('Ride ID is required'),
  body('type').isIn(['safety', 'behavior', 'vehicle', 'payment', 'fraud', 'other']).withMessage('Invalid incident type'),
  body('description').notEmpty().withMessage('Description is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rideId, type, category, description, severity, location, evidence } = req.body;

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    // Create incident report
    const incident = await Incident.create({
      ride: rideId,
      reportedBy: req.user.id,
      reportedAgainst: ride.rider._id.toString() === req.user.id ? ride.driver : ride.rider,
      type,
      category,
      description,
      severity: severity || 'medium',
      location,
      evidence: evidence || []
    });

    // Add to ride's incident reports
    ride.incidentReports.push({
      reportedBy: req.user.id,
      type,
      description,
      severity: severity || 'medium',
      reportedAt: new Date(),
      status: 'pending'
    });
    await ride.save();

    // Notify admin
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('new-incident', incident.toObject());
    }

    res.status(201).json({
      message: 'Incident reported successfully',
      incident: incident.toObject()
    });
  } catch (error) {
    console.error('Incident report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/security/incidents
// @desc    Get user's incident reports
// @access  Private
router.get('/incidents', protect, async (req, res) => {
  try {
    const incidents = await Incident.find({
      $or: [
        { reportedBy: req.user.id },
        { reportedAgainst: req.user.id }
      ]
    })
      .populate('ride', 'pickupLocation dropoffLocation status fare')
      .populate('reportedBy', 'name email')
      .populate('reportedAgainst', 'name email')
      .sort({ createdAt: -1 });

    res.json(incidents);
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/security/2fa/setup
// @desc    Setup two-factor authentication
// @access  Private
router.post('/2fa/setup', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Generate secret with proper encoding
    // Clean email for QR code (remove special characters that can break QR codes)
    const cleanEmail = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const secret = speakeasy.generateSecret({
      name: cleanEmail, // Use cleaned email part only
      issuer: 'Mzansi',
      length: 32
    });

    // Save secret temporarily (user needs to verify before enabling)
    user.security = user.security || {};
    user.security.twoFactorSecret = secret.base32;
    
    await user.save();

    // Generate QR code with proper settings for authenticator apps
    const otpauthUrl = secret.otpauth_url;
    
    // Ensure the URL is properly formatted
    if (!otpauthUrl) {
      return res.status(500).json({ message: 'Failed to generate 2FA secret' });
    }

    console.log('Generated otpauth URL:', otpauthUrl);

    // Generate QR code with optimal settings for scanning
    let qrCodeUrl;
    try {
      qrCodeUrl = await QRCode.toDataURL(otpauthUrl, {
        errorCorrectionLevel: 'H', // High error correction for better scanning
        type: 'image/png',
        margin: 4, // Larger margin for better scanning
        color: {
          dark: '#000000', // Black
          light: '#FFFFFF' // White
        },
        width: 400 // Larger size for better scanning
      });
    } catch (qrError) {
      console.error('QR code generation error:', qrError);
      // Fallback with simpler settings
      qrCodeUrl = await QRCode.toDataURL(otpauthUrl, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 300
      });
    }

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32,
      otpauthUrl: otpauthUrl, // Also return the URL for manual entry
      // Format manual entry key in groups for easier reading
      formattedKey: secret.base32.match(/.{1,4}/g)?.join(' ') || secret.base32
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/security/2fa/verify
// @desc    Verify and enable 2FA
// @access  Private
router.post('/2fa/verify', protect, [
  body('token').notEmpty().withMessage('Token is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.security || !user.security.twoFactorSecret) {
      return res.status(400).json({ message: '2FA not set up' });
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.security.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({ message: 'Invalid token' });
    }

    // Enable 2FA
    user.security.twoFactorEnabled = true;
    await user.save();

    res.json({ message: '2FA enabled successfully' });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/security/2fa/disable
// @desc    Disable two-factor authentication
// @access  Private
router.post('/2fa/disable', protect, [
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { password } = req.body;
    const user = await User.findById(req.user.id);

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Disable 2FA
    user.security = user.security || {};
    user.security.twoFactorEnabled = false;
    user.security.twoFactorSecret = null;
    await user.save();

    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/security/trusted-contacts
// @desc    Add trusted contact
// @access  Private
router.post('/trusted-contacts', protect, [
  body('name').notEmpty().withMessage('Name is required'),
  body('phone').notEmpty().withMessage('Phone is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, email, relationship, canTrackTrips } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.trustedContacts) {
      user.trustedContacts = [];
    }

    // Check if contact already exists
    const exists = user.trustedContacts.find(tc => tc.phone === phone);
    if (exists) {
      return res.status(400).json({ message: 'Contact already exists' });
    }

    user.trustedContacts.push({
      name,
      phone,
      email,
      relationship: relationship || 'friend',
      canTrackTrips: canTrackTrips !== false
    });

    await user.save();

    res.json({
      message: 'Trusted contact added',
      contact: user.trustedContacts[user.trustedContacts.length - 1]
    });
  } catch (error) {
    console.error('Add trusted contact error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/security/trusted-contacts/:id
// @desc    Remove trusted contact
// @access  Private
router.delete('/trusted-contacts/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.trustedContacts) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    user.trustedContacts = user.trustedContacts.filter(
      (tc, index) => index.toString() !== req.params.id
    );

    await user.save();

    res.json({ message: 'Contact removed' });
  } catch (error) {
    console.error('Remove trusted contact error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

