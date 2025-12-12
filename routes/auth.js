const express = require('express');
const jwt = require('jsonwebtoken');
const {
    body,
    validationResult
} = require('express-validator');
const User = require('../models/User');
const {
    protect
} = require('../middleware/auth');

const router = express.Router();

// Generate session token (random string to track active session)
const generateSessionToken = () => {
    return require('crypto').randomBytes(32).toString('hex');
};

// Generate JWT Token with session token
const generateToken = (id, sessionToken) => {
    return jwt.sign({
        id,
        sessionToken
    }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d',
    });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({
        min: 6
    }).withMessage('Password must be at least 6 characters'),
    body('phone').notEmpty().withMessage('Phone number is required'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const {
            name,
            email,
            password,
            phone,
            role
        } = req.body;

        // Check if user exists
        const userExists = await User.findOne({
            email
        });
        if (userExists) {
            return res.status(400).json({
                message: 'User already exists'
            });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            phone,
            role: role || 'rider',
            isDriver: role === 'driver',
            isCourier: role === 'courier',
            verification: {
                emailVerified: false,
                phoneVerified: false,
            },
        });

        const token = generateToken(user._id);

        res.status(201).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isDriver: user.isDriver,
                isCourier: user.isCourier
            }
        });
    } catch (error) {
        console.error('Register error:', error);

        // Handle MongoDB duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                message: 'User with this email already exists'
            });
        }

        // Handle validation errors from mongoose
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.map(msg => ({
                    msg
                }))
            });
        }

        res.status(500).json({
            message: error.message || 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const {
            email,
            password
        } = req.body;

        // Check if user exists
        const user = await User.findOne({
            email
        });
        if (!user) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        // Ensure driverInfo is initialized for drivers
        if (user.isDriver && !user.driverInfo) {
            console.log('⚠️ Driver has no driverInfo, initializing...');
            user.driverInfo = {
                isVerified: false,
                isAvailable: false,
                rating: 0,
                totalRides: 0
            };
            await user.save();
        }

        // Auto-verify drivers for development (to ensure profile loads)
        if (user.isDriver && user.driverInfo && !user.driverInfo.isVerified) {
            console.log('✅ Auto-verifying driver for development:', user._id);
            user.driverInfo.isVerified = true;
            await user.save();
        }

        // Ensure courierInfo is initialized for couriers
        if (user.isCourier && !user.courierInfo) {
            console.log('⚠️ Courier has no courierInfo, initializing...');
            user.courierInfo = {
                isVerified: false,
                isAvailable: false,
                averageRating: 0,
                totalDeliveries: 0
            };
            await user.save();
        }

        // Auto-verify couriers for development (to ensure profile loads)
        if (user.isCourier && user.courierInfo && !user.courierInfo.isVerified) {
            console.log('✅ Auto-verifying courier for development:', user._id);
            user.courierInfo.isVerified = true;
            await user.save();
        }

        // Generate new session token - this invalidates any previous sessions
        const sessionToken = generateSessionToken();
        const previousSession = user.currentSessionToken;
        user.currentSessionToken = sessionToken;
        user.sessionCreatedAt = new Date();

        // Update last login info
        if (user.security) {
            user.security.lastLoginTime = new Date();
            user.security.lastLoginIP = req.ip || req.connection.remoteAddress;
        }

        await user.save();

        // Log session invalidation if there was a previous session
        if (previousSession) {
            console.log(`🔒 Invalidated previous session for user ${user.email} (${user.role})`);
        }

        const token = generateToken(user._id, sessionToken);

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isDriver: user.isDriver,
                isCourier: user.isCourier,
                driverInfo: user.driverInfo || (user.isDriver ? {
                    isVerified: true,
                    isAvailable: false,
                    rating: 0,
                    totalRides: 0
                } : null),
                courierInfo: user.courierInfo || (user.isCourier ? {
                    isVerified: true,
                    isAvailable: false,
                    averageRating: 0,
                    totalDeliveries: 0
                } : null)
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user (invalidate session)
// @access  Private
router.post('/logout', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user) {
            // Clear session token to invalidate all tokens
            user.currentSessionToken = null;
            user.sessionCreatedAt = null;
            await user.save();
            console.log(`✅ User ${user.email} logged out successfully`);
        }
        res.json({
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            console.error('User not found for ID:', req.user.id);
            return res.status(404).json({
                message: 'User not found'
            });
        }

        // Ensure driverInfo is initialized for drivers
        if (user.isDriver && !user.driverInfo) {
            console.log('⚠️ Driver has no driverInfo, initializing...');
            user.driverInfo = {
                isVerified: false,
                isAvailable: false,
                rating: 0,
                totalRides: 0
            };
            await user.save();
        }

        // Auto-verify drivers for development (to avoid profile loading issues)
        if (user.isDriver && user.driverInfo && !user.driverInfo.isVerified) {
            console.log('✅ Auto-verifying driver for development:', user._id);
            user.driverInfo.isVerified = true;
            await user.save();
        }

        // Ensure courierInfo is initialized for couriers
        if (user.isCourier && !user.courierInfo) {
            console.log('⚠️ Courier has no courierInfo, initializing...');
            user.courierInfo = {
                isVerified: false,
                isAvailable: false,
                averageRating: 0,
                totalDeliveries: 0
            };
            await user.save();
        }

        // Auto-verify couriers for development (to avoid profile loading issues)
        if (user.isCourier && user.courierInfo && !user.courierInfo.isVerified) {
            console.log('✅ Auto-verifying courier for development:', user._id);
            user.courierInfo.isVerified = true;
            await user.save();
        }

        console.log('📤 Sending user data to client:', {
            id: user._id,
            name: user.name,
            email: user.email,
            isDriver: user.isDriver,
            hasDriverInfo: !!user.driverInfo,
            isVerified: user.driverInfo ? .isVerified,
            driverInfo: user.driverInfo
        });

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;