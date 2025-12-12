const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                message: 'Not authorized, no token'
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({
                    message: 'User not found'
                });
            }

            // Check if session token matches - prevents multiple simultaneous logins
            // If token doesn't have sessionToken (old tokens), allow it but update to new system
            if (decoded.sessionToken) {
                if (!req.user.currentSessionToken || req.user.currentSessionToken !== decoded.sessionToken) {
                    console.log(`🚫 Session mismatch for user ${req.user.email}. Token session: ${decoded.sessionToken}, User session: ${req.user.currentSessionToken}`);
                    return res.status(401).json({
                        message: 'Session expired. Please login again. Another device may have logged in with this account.'
                    });
                }
            } else {
                // Legacy token without sessionToken - generate new session for migration
                const crypto = require('crypto');
                req.user.currentSessionToken = crypto.randomBytes(32).toString('hex');
                req.user.sessionCreatedAt = new Date();
                await req.user.save();
            }

            next();
        } catch (error) {
            return res.status(401).json({
                message: 'Not authorized, token failed'
            });
        }
    } catch (error) {
        res.status(500).json({
            message: 'Server error'
        });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        // Check if user has the required role
        const hasRole = roles.includes(req.user.role);

        // For driver routes, also check isDriver flag
        const isDriverRoute = roles.includes('driver');
        const isDriver = req.user.isDriver || req.user.role === 'driver';

        // Allow access if user has the role OR if it's a driver route and user is a driver
        if (!hasRole && !(isDriverRoute && isDriver)) {
            return res.status(403).json({
                message: `User role '${req.user.role}' is not authorized to access this route`
            });
        }
        next();
    };
};

module.exports = {
    protect,
    authorize
};