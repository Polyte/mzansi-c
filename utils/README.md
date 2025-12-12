# Utility Functions

This directory contains reusable utility functions for the ride-sharing application.

## Modules

### `location.js`
Location and distance calculation utilities:
- `calculateDistance(location1, location2)` - Calculate distance between two coordinates (Haversine formula)
- `calculateEstimatedTime(distanceKm, averageSpeedKmh)` - Calculate estimated travel time
- `findNearestLocations(locations, targetLocation, maxDistanceKm)` - Find nearest drivers/couriers
- `isWithinRadius(location1, location2, radiusKm)` - Check if location is within radius
- `formatDistance(distanceKm)` - Format distance for display (e.g., "5.2 km" or "250 m")
- `formatEstimatedTime(minutes)` - Format time for display (e.g., "5 min" or "1h 30 min")

### `pricing.js`
Pricing and fare calculation utilities:
- `calculateRideFare(distanceKm, rideType, options)` - Calculate ride fare with surge, discounts, taxes
- `calculateDeliveryFare(distanceKm, deliveryType, itemWeight, options)` - Calculate delivery fare
- `calculateSurgeMultiplier(activeRides, availableDrivers)` - Calculate surge pricing based on demand
- `formatPrice(amount)` - Format price for display (e.g., "R 150.00")
- `applyPromoDiscount(totalFare, promoCode)` - Apply promo code discount

### `rating.js`
Rating calculation and management utilities:
- `calculateAverageRating(ratings)` - Calculate average from array of ratings
- `updateUserRating(user, newRating, type)` - Update user rating after new rating
- `getRatingBadge(rating)` - Get rating badge/tier information
- `isValidRating(rating)` - Validate rating value (1-5)
- `formatRating(rating, decimals)` - Format rating for display

### `validation.js`
Input validation utilities:
- `isValidEmail(email)` - Validate email format
- `isValidPhone(phone)` - Validate South African phone number
- `formatPhone(phone)` - Format phone to standard format (+27...)
- `validatePassword(password)` - Validate password strength
- `isValidCoordinates(latitude, longitude)` - Validate coordinates
- `isValidLocation(location)` - Validate location object
- `sanitizeString(input, maxLength)` - Sanitize string input
- `isFutureDate(date)` - Check if date is in the future
- `isPastDate(date)` - Check if date is in the past

### `analytics.js`
Analytics and statistics utilities:
- `calculateRevenue(transactions)` - Calculate total revenue statistics
- `calculatePeriodStats(data, period)` - Calculate statistics by time period
- `calculateAverageMetrics(items)` - Calculate average ride/delivery metrics
- `getTopPerformers(users, limit)` - Get top performing drivers/couriers
- `calculateCompletionRate(completed, total)` - Calculate completion rate percentage
- `calculateCancellationRate(cancelled, total)` - Calculate cancellation rate percentage

### `helpers.js`
General helper utilities:
- `generateCode(length, alphanumeric)` - Generate unique code
- `generateReceiptNumber()` - Generate receipt number
- `getTimeDifference(startDate, endDate)` - Get human-readable time difference
- `formatDate(date, format)` - Format date for display
- `debounce(func, wait)` - Debounce function execution
- `throttle(func, wait)` - Throttle function execution
- `deepClone(obj)` - Deep clone object
- `sleep(ms)` - Sleep/delay function
- `retryWithBackoff(fn, maxRetries, delay)` - Retry function with exponential backoff
- `isEmpty(value)` - Check if value is empty

## Usage

```javascript
// Import all utilities
const utils = require('../utils');

// Or import specific modules
const { calculateDistance, formatPrice } = require('../utils');
const { calculateRideFare } = require('../utils/pricing');

// Example usage
const distance = calculateDistance(
  { latitude: -26.2041, longitude: 28.0473 },
  { latitude: -26.1076, longitude: 28.0567 }
);

const fare = calculateRideFare(distance, 'comfort', {
  surgeMultiplier: 1.5,
  promoDiscount: 10
});
```

## Benefits

1. **Code Reusability** - Functions can be used across multiple routes
2. **Consistency** - Same logic applied everywhere
3. **Maintainability** - Update logic in one place
4. **Testability** - Easy to unit test utility functions
5. **Readability** - Cleaner route files
