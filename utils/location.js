/**
 * Location utility functions
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Object} location1 - {latitude, longitude}
 * @param {Object} location2 - {latitude, longitude}
 * @returns {Number} Distance in kilometers
 */
const calculateDistance = (location1, location2) => {
    if (!location1 || !location2 || !location1.latitude || !location1.longitude ||
        !location2.latitude || !location2.longitude) {
        return 0;
    }

    const R = 6371; // Earth's radius in km
    const lat1 = location1.latitude;
    const lon1 = location1.longitude;
    const lat2 = location2.latitude;
    const lon2 = location2.longitude;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate estimated travel time based on distance
 * @param {Number} distanceKm - Distance in kilometers
 * @param {Number} averageSpeedKmh - Average speed in km/h (default: 50 for city, 80 for highway)
 * @returns {Number} Estimated time in minutes
 */
const calculateEstimatedTime = (distanceKm, averageSpeedKmh = 50) => {
    if (!distanceKm || distanceKm <= 0) return 0;
    const timeInHours = distanceKm / averageSpeedKmh;
    const timeInMinutes = timeInHours * 60;
    return Math.ceil(timeInMinutes); // Round up to nearest minute
};

/**
 * Find nearest drivers/couriers to a location
 * @param {Array} locations - Array of {userId, latitude, longitude}
 * @param {Object} targetLocation - {latitude, longitude}
 * @param {Number} maxDistanceKm - Maximum distance in km (default: 10)
 * @returns {Array} Sorted array of nearest locations with distance
 */
const findNearestLocations = (locations, targetLocation, maxDistanceKm = 10) => {
    if (!locations || !Array.isArray(locations) || !targetLocation) {
        return [];
    }

    return locations
        .map(loc => {
            const distance = calculateDistance(targetLocation, {
                latitude: loc.latitude,
                longitude: loc.longitude
            });
            return {
                ...loc,
                distance
            };
        })
        .filter(loc => loc.distance <= maxDistanceKm)
        .sort((a, b) => a.distance - b.distance);
};

/**
 * Check if a location is within a radius of another location
 * @param {Object} location1 - {latitude, longitude}
 * @param {Object} location2 - {latitude, longitude}
 * @param {Number} radiusKm - Radius in kilometers
 * @returns {Boolean}
 */
const isWithinRadius = (location1, location2, radiusKm) => {
    const distance = calculateDistance(location1, location2);
    return distance <= radiusKm;
};

/**
 * Format distance for display
 * @param {Number} distanceKm - Distance in kilometers
 * @returns {String} Formatted distance (e.g., "5.2 km" or "250 m")
 */
const formatDistance = (distanceKm) => {
    if (!distanceKm || distanceKm < 0) return '0 m';

    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
};

/**
 * Format estimated time for display
 * @param {Number} minutes - Time in minutes
 * @returns {String} Formatted time (e.g., "5 min" or "1h 30 min")
 */
const formatEstimatedTime = (minutes) => {
    if (!minutes || minutes < 0) return '0 min';

    if (minutes < 60) {
        return `${Math.round(minutes)} min`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);

    if (mins === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${mins} min`;
};

module.exports = {
    calculateDistance,
    calculateEstimatedTime,
    findNearestLocations,
    isWithinRadius,
    formatDistance,
    formatEstimatedTime
};