/**
 * Validation utility functions
 */

/**
 * Validate email format
 * @param {String} email - Email to validate
 * @returns {Boolean} True if valid
 */
const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
};

/**
 * Validate phone number (South African format)
 * @param {String} phone - Phone number to validate
 * @returns {Boolean} True if valid
 */
const isValidPhone = (phone) => {
    if (!phone || typeof phone !== 'string') return false;
    // Remove spaces, dashes, and plus signs
    const cleaned = phone.replace(/[\s\-+]/g, '');
    // Check if it's 10 digits (with or without country code)
    const phoneRegex = /^(\+27|0)?[1-9]\d{8}$/;
    return phoneRegex.test(cleaned);
};

/**
 * Format phone number to standard format
 * @param {String} phone - Phone number to format
 * @returns {String} Formatted phone number
 */
const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/[\s\-+]/g, '');

    // If starts with 0, replace with +27
    if (cleaned.startsWith('0')) {
        return '+27' + cleaned.substring(1);
    }

    // If doesn't start with +, add +27
    if (!cleaned.startsWith('+')) {
        return '+27' + cleaned;
    }

    return cleaned;
};

/**
 * Validate password strength
 * @param {String} password - Password to validate
 * @returns {Object} { isValid, errors }
 */
const validatePassword = (password) => {
    const errors = [];

    if (!password || password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }

    if (password.length > 128) {
        errors.push('Password must be less than 128 characters');
    }

    // Optional: Add more strength requirements
    // if (!/[A-Z]/.test(password)) {
    //     errors.push('Password must contain at least one uppercase letter');
    // }
    // if (!/[a-z]/.test(password)) {
    //     errors.push('Password must contain at least one lowercase letter');
    // }
    // if (!/[0-9]/.test(password)) {
    //     errors.push('Password must contain at least one number');
    // }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate coordinates
 * @param {Number} latitude - Latitude
 * @param {Number} longitude - Longitude
 * @returns {Boolean} True if valid
 */
const isValidCoordinates = (latitude, longitude) => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return false;
    }

    // Latitude must be between -90 and 90
    if (latitude < -90 || latitude > 90) {
        return false;
    }

    // Longitude must be between -180 and 180
    if (longitude < -180 || longitude > 180) {
        return false;
    }

    return true;
};

/**
 * Validate location object
 * @param {Object} location - Location object with latitude and longitude
 * @returns {Boolean} True if valid
 */
const isValidLocation = (location) => {
    if (!location || typeof location !== 'object') {
        return false;
    }

    return isValidCoordinates(location.latitude, location.longitude);
};

/**
 * Sanitize string input
 * @param {String} input - String to sanitize
 * @param {Number} maxLength - Maximum length
 * @returns {String} Sanitized string
 */
const sanitizeString = (input, maxLength = 1000) => {
    if (typeof input !== 'string') return '';

    return input
        .trim()
        .substring(0, maxLength)
        .replace(/[<>]/g, ''); // Remove potential HTML tags
};

/**
 * Validate date is in the future
 * @param {Date} date - Date to validate
 * @returns {Boolean} True if date is in the future
 */
const isFutureDate = (date) => {
    if (!date) return false;
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj > new Date();
};

/**
 * Validate date is in the past
 * @param {Date} date - Date to validate
 * @returns {Boolean} True if date is in the past
 */
const isPastDate = (date) => {
    if (!date) return false;
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj < new Date();
};

module.exports = {
    isValidEmail,
    isValidPhone,
    formatPhone,
    validatePassword,
    isValidCoordinates,
    isValidLocation,
    sanitizeString,
    isFutureDate,
    isPastDate
};