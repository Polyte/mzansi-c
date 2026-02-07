/**
 * Analytics and statistics utility functions
 */

/**
 * Calculate total revenue from rides/deliveries
 * @param {Array} transactions - Array of transactions with fare/paymentStatus
 * @returns {Object} Revenue statistics
 */
const calculateRevenue = (transactions) => {
    if (!transactions || !Array.isArray(transactions)) {
        return {
            total: 0,
            paid: 0,
            pending: 0,
            failed: 0,
            count: 0
        };
    }

    const stats = transactions.reduce((acc, transaction) => {
        const fare = transaction.fare || transaction.totalFare || 0;
        const status = transaction.paymentStatus || 'pending';

        acc.total += fare;
        acc.count += 1;

        if (status === 'paid') {
            acc.paid += fare;
        } else if (status === 'pending') {
            acc.pending += fare;
        } else if (status === 'failed') {
            acc.failed += fare;
        }

        return acc;
    }, {
        total: 0,
        paid: 0,
        pending: 0,
        failed: 0,
        count: 0
    });

    return {
        total: Math.round(stats.total * 100) / 100,
        paid: Math.round(stats.paid * 100) / 100,
        pending: Math.round(stats.pending * 100) / 100,
        failed: Math.round(stats.failed * 100) / 100,
        count: stats.count
    };
};

/**
 * Calculate statistics for a time period
 * @param {Array} data - Array of data objects with timestamps
 * @param {String} period - 'day', 'week', 'month', 'year'
 * @returns {Object} Statistics grouped by period
 */
const calculatePeriodStats = (data, period = 'day') => {
    if (!data || !Array.isArray(data)) {
        return {};
    }

    const stats = {};
    const now = new Date();

    data.forEach(item => {
        const date = new Date(item.createdAt || item.timestamp || item.date);
        let key;

        if (period === 'day') {
            key = date.toISOString().split('T')[0]; // YYYY-MM-DD
        } else if (period === 'week') {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split('T')[0];
        } else if (period === 'month') {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else if (period === 'year') {
            key = String(date.getFullYear());
        }

        if (!stats[key]) {
            stats[key] = {
                count: 0,
                total: 0
            };
        }

        stats[key].count += 1;
        stats[key].total += (item.fare || item.totalFare || 0);
    });

    return stats;
};

/**
 * Calculate average ride/delivery metrics
 * @param {Array} items - Array of rides/deliveries
 * @returns {Object} Average metrics
 */
const calculateAverageMetrics = (items) => {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return {
            averageFare: 0,
            averageDistance: 0,
            averageDuration: 0,
            averageRating: 0,
            count: 0
        };
    }

    const validItems = items.filter(item => item.fare || item.totalFare);

    if (validItems.length === 0) {
        return {
            averageFare: 0,
            averageDistance: 0,
            averageDuration: 0,
            averageRating: 0,
            count: 0
        };
    }

    const totals = validItems.reduce((acc, item) => {
        acc.fare += (item.fare || item.totalFare || 0);
        acc.distance += (item.distance || 0);
        acc.duration += (item.duration || 0);
        acc.rating += (item.rating?.rider?.stars || item.rating?.driver?.stars || 0);
        return acc;
    }, {
        fare: 0,
        distance: 0,
        duration: 0,
        rating: 0
    });

    const count = validItems.length;

    return {
        averageFare: Math.round((totals.fare / count) * 100) / 100,
        averageDistance: Math.round((totals.distance / count) * 100) / 100,
        averageDuration: Math.round((totals.duration / count) * 100) / 100,
        averageRating: Math.round((totals.rating / count) * 10) / 10,
        count
    };
};

/**
 * Get top performers (drivers/couriers)
 * @param {Array} users - Array of user objects with ratings and totals
 * @param {Number} limit - Number of top performers to return
 * @returns {Array} Sorted array of top performers
 */
const getTopPerformers = (users, limit = 10) => {
    if (!users || !Array.isArray(users)) {
        return [];
    }

    return users
        .filter(user => {
            if (user.isDriver) {
                return user.driverInfo && user.driverInfo.totalRides > 0;
            } else if (user.isCourier) {
                return user.courierInfo && user.courierInfo.totalDeliveries > 0;
            }
            return false;
        })
        .map(user => {
            if (user.isDriver) {
                return {
                    ...user,
                    performanceScore: (user.driverInfo.rating || 0) * (user.driverInfo.totalRides || 0)
                };
            } else {
                return {
                    ...user,
                    performanceScore: (user.courierInfo.averageRating || 0) * (user.courierInfo.totalDeliveries || 0)
                };
            }
        })
        .sort((a, b) => b.performanceScore - a.performanceScore)
        .slice(0, limit);
};

/**
 * Calculate completion rate
 * @param {Number} completed - Number of completed items
 * @param {Number} total - Total number of items
 * @returns {Number} Completion rate as percentage
 */
const calculateCompletionRate = (completed, total) => {
    if (!total || total === 0) return 0;
    return Math.round((completed / total) * 100);
};

/**
 * Calculate cancellation rate
 * @param {Number} cancelled - Number of cancelled items
 * @param {Number} total - Total number of items
 * @returns {Number} Cancellation rate as percentage
 */
const calculateCancellationRate = (cancelled, total) => {
    if (!total || total === 0) return 0;
    return Math.round((cancelled / total) * 100);
};

module.exports = {
    calculateRevenue,
    calculatePeriodStats,
    calculateAverageMetrics,
    getTopPerformers,
    calculateCompletionRate,
    calculateCancellationRate
};
