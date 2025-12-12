/**
 * Rating utility functions
 */

/**
 * Calculate average rating from array of ratings
 * @param {Array} ratings - Array of rating numbers
 * @returns {Number} Average rating rounded to 1 decimal place
 */
const calculateAverageRating = (ratings) => {
    if (!ratings || !Array.isArray(ratings) || ratings.length === 0) {
        return 0;
    }

    const validRatings = ratings.filter(r => typeof r === 'number' && r >= 0 && r <= 5);
    if (validRatings.length === 0) return 0;

    const sum = validRatings.reduce((acc, rating) => acc + rating, 0);
    const average = sum / validRatings.length;

    return Math.round(average * 10) / 10; // Round to 1 decimal place
};

/**
 * Update user rating after a new rating is added
 * @param {Object} user - User object with existing rating data
 * @param {Number} newRating - New rating (1-5)
 * @param {String} type - 'driver' or 'rider'
 * @returns {Object} Updated rating data
 */
const updateUserRating = (user, newRating, type = 'driver') => {
    if (!user || typeof newRating !== 'number' || newRating < 1 || newRating > 5) {
        return null;
    }

    if (type === 'driver' && user.driverInfo) {
        const currentRating = user.driverInfo.rating || 0;
        const totalRides = user.driverInfo.totalRides || 0;

        // Calculate new average: (oldAverage * oldCount + newRating) / (oldCount + 1)
        const newAverage = totalRides > 0 ?
            ((currentRating * totalRides) + newRating) / (totalRides + 1) :
            newRating;

        return {
            rating: Math.round(newAverage * 10) / 10,
            totalRides: totalRides + 1
        };
    } else if (type === 'courier' && user.courierInfo) {
        const currentRating = user.courierInfo.averageRating || 0;
        const totalDeliveries = user.courierInfo.totalDeliveries || 0;

        const newAverage = totalDeliveries > 0 ?
            ((currentRating * totalDeliveries) + newRating) / (totalDeliveries + 1) :
            newRating;

        return {
            averageRating: Math.round(newAverage * 10) / 10,
            totalDeliveries: totalDeliveries + 1
        };
    } else {
        // For riders
        const currentRating = user.rating || 0;
        const totalRides = user.totalRides || 0;

        const newAverage = totalRides > 0 ?
            ((currentRating * totalRides) + newRating) / (totalRides + 1) :
            newRating;

        return {
            rating: Math.round(newAverage * 10) / 10,
            totalRides: totalRides + 1
        };
    }
};

/**
 * Get rating badge/tier based on average rating
 * @param {Number} rating - Average rating (0-5)
 * @returns {Object} Badge information
 */
const getRatingBadge = (rating) => {
    if (!rating || rating < 0) {
        return {
            tier: 'new',
            label: 'New',
            color: '#gray'
        };
    }

    if (rating >= 4.8) {
        return {
            tier: 'excellent',
            label: 'Excellent',
            color: '#10b981'
        };
    } else if (rating >= 4.5) {
        return {
            tier: 'great',
            label: 'Great',
            color: '#3b82f6'
        };
    } else if (rating >= 4.0) {
        return {
            tier: 'good',
            label: 'Good',
            color: '#8b5cf6'
        };
    } else if (rating >= 3.5) {
        return {
            tier: 'average',
            label: 'Average',
            color: '#f59e0b'
        };
    } else if (rating >= 3.0) {
        return {
            tier: 'below_average',
            label: 'Below Average',
            color: '#ef4444'
        };
    } else {
        return {
            tier: 'poor',
            label: 'Needs Improvement',
            color: '#dc2626'
        };
    }
};

/**
 * Validate rating value
 * @param {Number} rating - Rating to validate
 * @returns {Boolean} True if valid
 */
const isValidRating = (rating) => {
    return typeof rating === 'number' && rating >= 1 && rating <= 5 && Number.isInteger(rating);
};

/**
 * Format rating for display
 * @param {Number} rating - Rating value
 * @param {Number} decimals - Number of decimal places (default: 1)
 * @returns {String} Formatted rating (e.g., "4.5")
 */
const formatRating = (rating, decimals = 1) => {
    if (!rating || rating < 0) return '0.0';
    return rating.toFixed(decimals);
};

module.exports = {
    calculateAverageRating,
    updateUserRating,
    getRatingBadge,
    isValidRating,
    formatRating
};