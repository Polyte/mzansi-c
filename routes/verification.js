const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Generate 6-digit verification code
const generateVerificationCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Send email verification code
const sendEmailVerificationCode = async (email, code) => {
  try {
    // Create transporter (configure with your email service)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Mzansi - Email Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Your verification code is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; margin: 0; font-size: 32px; letter-spacing: 5px;">${code}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email verification code sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

// Send SMS verification code
const sendSMSVerificationCode = async (phone, code) => {
  try {
    // Initialize Twilio client
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    await client.messages.create({
      body: `Your Mzansi verification code is: ${code}. This code expires in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    console.log(`✅ SMS verification code sent to ${phone}`);
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    // In development, log the code instead of failing
    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 [DEV] SMS code for ${phone}: ${code}`);
      return true;
    }
    return false;
  }
};

// @route   POST /api/verification/send-email-code
// @desc    Send email verification code
// @access  Private
router.post('/send-email-code', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.verification?.emailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    const code = generateVerificationCode();
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 10); // 10 minutes expiry

    // Initialize verification object if it doesn't exist
    if (!user.verification) {
      user.verification = {};
    }

    user.verification.emailVerificationCode = code;
    user.verification.emailVerificationCodeExpiry = expiry;
    await user.save();

    // Send email
    const emailSent = await sendEmailVerificationCode(user.email, code);
    
    if (!emailSent && process.env.NODE_ENV === 'production') {
      return res.status(500).json({ message: 'Failed to send verification email' });
    }

    // In development, return the code
    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 [DEV] Email verification code for ${user.email}: ${code}`);
    }

    res.json({
      message: 'Verification code sent to your email',
      // Only include code in development
      ...(process.env.NODE_ENV === 'development' && { code }),
    });
  } catch (error) {
    console.error('Send email code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/verification/verify-email
// @desc    Verify email with code
// @access  Private
router.post('/verify-email', [
  protect,
  body('code').isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.verification?.emailVerified) {
      return res.json({ message: 'Email already verified', verified: true });
    }

    if (!user.verification?.emailVerificationCode) {
      return res.status(400).json({ message: 'No verification code found. Please request a new code.' });
    }

    // Check if code has expired
    if (new Date() > user.verification.emailVerificationCodeExpiry) {
      return res.status(400).json({ message: 'Verification code has expired. Please request a new code.' });
    }

    // Verify code
    if (user.verification.emailVerificationCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Mark email as verified
    if (!user.verification) {
      user.verification = {};
    }
    user.verification.emailVerified = true;
    user.verification.verifiedAt = new Date();
    user.verification.emailVerificationCode = undefined;
    user.verification.emailVerificationCodeExpiry = undefined;
    await user.save();

    res.json({
      message: 'Email verified successfully',
      verified: true,
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/verification/send-sms-code
// @desc    Send SMS verification code
// @access  Private
router.post('/send-sms-code', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.verification?.phoneVerified) {
      return res.status(400).json({ message: 'Phone already verified' });
    }

    if (!user.phone) {
      return res.status(400).json({ message: 'Phone number not found' });
    }

    const code = generateVerificationCode();
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 10); // 10 minutes expiry

    // Initialize verification object if it doesn't exist
    if (!user.verification) {
      user.verification = {};
    }

    user.verification.phoneVerificationCode = code;
    user.verification.phoneVerificationCodeExpiry = expiry;
    await user.save();

    // Send SMS
    const smsSent = await sendSMSVerificationCode(user.phone, code);
    
    if (!smsSent && process.env.NODE_ENV === 'production') {
      return res.status(500).json({ message: 'Failed to send verification SMS' });
    }

    // In development, return the code
    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 [DEV] SMS verification code for ${user.phone}: ${code}`);
    }

    res.json({
      message: 'Verification code sent to your phone',
      // Only include code in development
      ...(process.env.NODE_ENV === 'development' && { code }),
    });
  } catch (error) {
    console.error('Send SMS code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/verification/verify-phone
// @desc    Verify phone with code
// @access  Private
router.post('/verify-phone', [
  protect,
  body('code').isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.verification?.phoneVerified) {
      return res.json({ message: 'Phone already verified', verified: true });
    }

    if (!user.verification?.phoneVerificationCode) {
      return res.status(400).json({ message: 'No verification code found. Please request a new code.' });
    }

    // Check if code has expired
    if (new Date() > user.verification.phoneVerificationCodeExpiry) {
      return res.status(400).json({ message: 'Verification code has expired. Please request a new code.' });
    }

    // Verify code
    if (user.verification.phoneVerificationCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Mark phone as verified
    if (!user.verification) {
      user.verification = {};
    }
    user.verification.phoneVerified = true;
    user.verification.verifiedAt = new Date();
    user.verification.phoneVerificationCode = undefined;
    user.verification.phoneVerificationCodeExpiry = undefined;
    await user.save();

    res.json({
      message: 'Phone verified successfully',
      verified: true,
    });
  } catch (error) {
    console.error('Verify phone error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/verification/status
// @desc    Get verification status
// @access  Private
router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('verification isDriver driverInfo');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const response = {
      emailVerified: user.verification?.emailVerified || false,
      phoneVerified: user.verification?.phoneVerified || false,
    };

    // For drivers, include driver verification status
    if (user.isDriver) {
      response.driverVerified = user.driverInfo?.isVerified || false;
    }

    res.json(response);
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/verification/verify-driver
// @desc    Verify driver (admin only or automated)
// @access  Private (Admin or automated)
router.put('/verify-driver/:driverId', protect, async (req, res) => {
  try {
    const { driverId } = req.params;
    const currentUser = await User.findById(req.user.id);

    // Check if current user is admin
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can verify drivers' });
    }

    const driver = await User.findById(driverId);
    
    if (!driver || !driver.isDriver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    if (!driver.driverInfo) {
      driver.driverInfo = {};
    }

    driver.driverInfo.isVerified = true;
    await driver.save();

    res.json({
      message: 'Driver verified successfully',
      driver: {
        id: driver._id,
        name: driver.name,
        isVerified: driver.driverInfo.isVerified,
      },
    });
  } catch (error) {
    console.error('Verify driver error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

