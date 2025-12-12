/**
 * Pricing utility functions
 */

/**
 * Calculate ride fare based on distance, ride type, and other factors
 * @param {Number} distanceKm - Distance in kilometers
 * @param {String} rideType - 'economy', 'comfort', 'premium', 'xl'
 * @param {Object} options - Additional options (surgeMultiplier, promoDiscount, etc.)
 * @returns {Object} { baseFare, distanceFare, totalFare, breakdown }
 */
const calculateRideFare = (distanceKm, rideType = 'economy', options = {}) => {
    const baseFares = {
        economy: 25,
        comfort: 40,
        premium: 60,
        xl: 80
    };

    const ratePerKm = {
        economy: 8,
        comfort: 12,
        premium: 18,
        xl: 25
    };

    const baseFare = baseFares[rideType] || baseFares.economy;
    const distanceFare = (distanceKm || 0) * (ratePerKm[rideType] || ratePerKm.economy);
    const subtotal = baseFare + distanceFare;

    // Apply surge pricing if applicable
    const surgeMultiplier = options.surgeMultiplier || 1;
    const afterSurge = subtotal * surgeMultiplier;

    // Apply promo code discount
    const promoDiscount = options.promoDiscount || 0;
    const discountAmount = Math.min(promoDiscount, afterSurge); // Don't discount more than total
    const afterDiscount = afterSurge - discountAmount;

    // Apply service fee (5% of subtotal)
    const serviceFee = afterDiscount * 0.05;

    // Apply taxes (15% VAT in South Africa)
    const tax = afterDiscount * 0.15;

    const totalFare = afterDiscount + serviceFee + tax;

    return {
        baseFare,
        distanceFare: Math.round(distanceFare * 100) / 100,
        subtotal: Math.round(subtotal * 100) / 100,
        surgeMultiplier,
        surgeAmount: surgeMultiplier > 1 ? Math.round((afterSurge - subtotal) * 100) / 100 : 0,
        promoDiscount: Math.round(discountAmount * 100) / 100,
        serviceFee: Math.round(serviceFee * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        totalFare: Math.round(totalFare * 100) / 100,
        currency: 'ZAR',
        breakdown: {
            base: baseFare,
            distance: Math.round(distanceFare * 100) / 100,
            surge: surgeMultiplier > 1 ? Math.round((afterSurge - subtotal) * 100) / 100 : 0,
            discount: Math.round(discountAmount * 100) / 100,
            serviceFee: Math.round(serviceFee * 100) / 100,
            tax: Math.round(tax * 100) / 100
        }
    };
};

/**
 * Calculate delivery fare
 * @param {Number} distanceKm - Distance in kilometers
 * @param {String} deliveryType - 'standard', 'express', 'scheduled'
 * @param {Number} itemWeight - Weight in kg
 * @param {Object} options - Additional options
 * @returns {Object} Fare breakdown
 */
const calculateDeliveryFare = (distanceKm, deliveryType = 'standard', itemWeight = 0, options = {}) => {
    const baseFares = {
        standard: 30,
        express: 50,
        scheduled: 35
    };

    const ratePerKm = {
        standard: 6,
        express: 10,
        scheduled: 7
    };

    const baseFare = baseFares[deliveryType] || baseFares.standard;
    const distanceFare = (distanceKm || 0) * (ratePerKm[deliveryType] || ratePerKm.standard);

    // Weight surcharge (R2 per kg over 5kg)
    const weightSurcharge = itemWeight > 5 ? (itemWeight - 5) * 2 : 0;

    // Fragile item surcharge
    const fragileSurcharge = options.isFragile ? 15 : 0;

    // Insurance fee (optional, 2% of item value)
    const insuranceFee = options.itemValue ? options.itemValue * 0.02 : 0;

    const subtotal = baseFare + distanceFare + weightSurcharge + fragileSurcharge + insuranceFee;

    // Apply promo discount if applicable
    const promoDiscount = options.promoDiscount || 0;
    const discountAmount = Math.min(promoDiscount, subtotal);
    const afterDiscount = subtotal - discountAmount;

    // Service fee (3% for deliveries)
    const serviceFee = afterDiscount * 0.03;

    // Tax (15% VAT)
    const tax = afterDiscount * 0.15;

    const totalFare = afterDiscount + serviceFee + tax;

    return {
        baseFare,
        distanceFare: Math.round(distanceFare * 100) / 100,
        weightSurcharge: Math.round(weightSurcharge * 100) / 100,
        fragileSurcharge: Math.round(fragileSurcharge * 100) / 100,
        insuranceFee: Math.round(insuranceFee * 100) / 100,
        subtotal: Math.round(subtotal * 100) / 100,
        promoDiscount: Math.round(discountAmount * 100) / 100,
        serviceFee: Math.round(serviceFee * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        totalFare: Math.round(totalFare * 100) / 100,
        currency: 'ZAR'
    };
};

/**
 * Calculate surge multiplier based on demand
 * @param {Number} activeRides - Number of active rides in area
 * @param {Number} availableDrivers - Number of available drivers in area
 * @returns {Number} Surge multiplier (1.0 to 3.0)
 */
const calculateSurgeMultiplier = (activeRides, availableDrivers) => {
    if (!availableDrivers || availableDrivers === 0) return 3.0; // Maximum surge if no drivers

    const ratio = activeRides / availableDrivers;

    if (ratio >= 3) return 3.0; // Very high demand
    if (ratio >= 2) return 2.5;
    if (ratio >= 1.5) return 2.0;
    if (ratio >= 1) return 1.5;
    if (ratio >= 0.5) return 1.2;

    return 1.0; // Normal demand
};

/**
 * Format price for display
 * @param {Number} amount - Amount in ZAR
 * @returns {String} Formatted price (e.g., "R 150.00")
 */
const formatPrice = (amount) => {
    if (amount === null || amount === undefined) return 'R 0.00';
    return `R ${Math.abs(amount).toFixed(2)}`;
};

/**
 * Apply promo code discount
 * @param {Number} totalFare - Original fare
 * @param {Object} promoCode - Promo code object with discount type and value
 * @returns {Number} Discount amount
 */
const applyPromoDiscount = (totalFare, promoCode) => {
    if (!promoCode || !promoCode.isActive) return 0;

    if (promoCode.discountType === 'percentage') {
        const discount = totalFare * (promoCode.discountValue / 100);
        return Math.min(discount, promoCode.maxDiscount || discount); // Cap at max discount
    } else if (promoCode.discountType === 'fixed') {
        return Math.min(promoCode.discountValue, totalFare); // Don't discount more than total
    }

    return 0;
};

module.exports = {
    calculateRideFare,
    calculateDeliveryFare,
    calculateSurgeMultiplier,
    formatPrice,
    applyPromoDiscount
};