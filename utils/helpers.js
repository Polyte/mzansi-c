/**
 * General helper utility functions
 */

/**
 * Generate a unique code (for share codes, verification codes, etc.)
 * @param {Number} length - Length of code (default: 6)
 * @param {Boolean} alphanumeric - Use alphanumeric characters (default: false, uses numbers only)
 * @returns {String} Generated code
 */
const generateCode = (length = 6, alphanumeric = false) => {
    const numbers = '0123456789';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const pool = alphanumeric ? chars : numbers;

    let code = '';
    for (let i = 0; i < length; i++) {
        code += pool.charAt(Math.floor(Math.random() * pool.length));
    }

    return code;
};

/**
 * Generate a receipt number
 * @returns {String} Receipt number (e.g., "RCP-2024-001234")
 */
const generateReceiptNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `RCP-${year}-${random}`;
};

/**
 * Calculate time difference in human-readable format
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date (default: now)
 * @returns {String} Human-readable time difference
 */
const getTimeDifference = (startDate, endDate = new Date()) => {
    if (!startDate) return 'Unknown';

    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);

    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMins > 0) {
        return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
};

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @param {String} format - Format type ('short', 'long', 'time')
 * @returns {String} Formatted date
 */
const formatDate = (date, format = 'short') => {
    if (!date) return 'N/A';

    const dateObj = date instanceof Date ? date : new Date(date);

    if (isNaN(dateObj.getTime())) return 'Invalid Date';

    if (format === 'time') {
        return dateObj.toLocaleTimeString('en-ZA', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } else if (format === 'long') {
        return dateObj.toLocaleDateString('en-ZA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } else {
        return dateObj.toLocaleDateString('en-ZA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
};

/**
 * Debounce function - delays execution until after wait time
 * @param {Function} func - Function to debounce
 * @param {Number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
const debounce = (func, wait = 300) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Throttle function - limits execution to once per wait time
 * @param {Function} func - Function to throttle
 * @param {Number} wait - Wait time in milliseconds
 * @returns {Function} Throttled function
 */
const throttle = (func, wait = 300) => {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, wait);
        }
    };
};

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const cloned = {};
        Object.keys(obj).forEach(key => {
            cloned[key] = deepClone(obj[key]);
        });
        return cloned;
    }
};

/**
 * Sleep/delay function
 * @param {Number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Number} maxRetries - Maximum number of retries
 * @param {Number} delay - Initial delay in milliseconds
 * @returns {Promise} Result of function
 */
const retryWithBackoff = async (fn, maxRetries = 3, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await sleep(delay * Math.pow(2, i)); // Exponential backoff
        }
    }
};

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 * @param {*} value - Value to check
 * @returns {Boolean} True if empty
 */
const isEmpty = (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
};

module.exports = {
    generateCode,
    generateReceiptNumber,
    getTimeDifference,
    formatDate,
    debounce,
    throttle,
    deepClone,
    sleep,
    retryWithBackoff,
    isEmpty
};