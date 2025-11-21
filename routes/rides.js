const express = require('express');
const { body, validationResult } = require('express-validator');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const axios = require('axios');

const router = express.Router();

// Helper function to calculate fare
const calculateFare = (pickupLocation, dropoffLocation, rideType = 'economy') => {
  // Base fare per ride type (in Rands)
  const baseFares = {
    economy: 25,
    comfort: 40,
    premium: 60,
    xl: 80
  };

  // Calculate distance (simplified - in production, use Google Directions API)
  const lat1 = pickupLocation.latitude;
  const lon1 = pickupLocation.longitude;
  const lat2 = dropoffLocation.latitude;
  const lon2 = dropoffLocation.longitude;

  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km

  // Rate per km
  const ratePerKm = {
    economy: 8,
    comfort: 12,
    premium: 18,
    xl: 25
  };

  const baseFare = baseFares[rideType] || baseFares.economy;
  const distanceFare = distance * (ratePerKm[rideType] || ratePerKm.economy);
  const totalFare = baseFare + distanceFare;

  return Math.round(totalFare * 100) / 100; // Round to 2 decimal places
};

// @route   POST /api/rides/calculate-fare
// @desc    Calculate fare for a ride
// @access  Private
router.post('/calculate-fare', protect, [
  body('pickupLocation').notEmpty().withMessage('Pickup location is required'),
  body('dropoffLocation').notEmpty().withMessage('Dropoff location is required'),
  body('rideType').optional().isIn(['economy', 'comfort', 'premium', 'xl']).withMessage('Invalid ride type'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { pickupLocation, dropoffLocation, rideType = 'economy' } = req.body;

    const fare = calculateFare(pickupLocation, dropoffLocation, rideType);

    res.json({
      fare,
      rideType,
      currency: 'ZAR'
    });
  } catch (error) {
    console.error('Calculate fare error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/rides
// @desc    Get all rides for the authenticated user (rider or driver) or all rides for admin
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let rides;

    // Admin can see all rides
    if (req.user.role === 'admin') {
      rides = await Ride.find()
        .populate('rider', 'name email phone')
        .populate('driver', 'name email phone')
        .sort({ createdAt: -1 });
    } else if (req.user.isDriver) {
      // Driver sees their rides
      rides = await Ride.find({ driver: req.user.id })
        .populate('rider', 'name email phone')
        .sort({ createdAt: -1 });
    } else {
      // Rider sees their rides
      rides = await Ride.find({ rider: req.user.id })
        .populate('driver', 'name email phone')
        .sort({ createdAt: -1 });
    }

    res.json(rides);
  } catch (error) {
    console.error('Get rides error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/rides
// @desc    Create a new ride
// @access  Private
router.post('/', protect, [
  body('pickupLocation').notEmpty().withMessage('Pickup location is required'),
  body('dropoffLocation').notEmpty().withMessage('Dropoff location is required'),
  body('rideType').optional().isIn(['economy', 'comfort', 'premium', 'xl']).withMessage('Invalid ride type'),
  body('paymentMethod').optional().isIn(['card', 'cash', 'ewallet']).withMessage('Invalid payment method'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { pickupLocation, dropoffLocation, rideType = 'economy', paymentMethod = 'card', distance } = req.body;

    // Calculate fare
    const fare = calculateFare(pickupLocation, dropoffLocation, rideType);

    // Create ride
    const ride = new Ride({
      rider: req.user.id,
      pickupLocation,
      dropoffLocation,
      rideType,
      paymentMethod,
      fare,
      distance: distance || 0,
      status: 'pending'
    });

    await ride.save();

    // Populate rider info
    await ride.populate('rider', 'name email phone');

    // Emit to admin room for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('new-ride', ride.toObject());

      // Find nearby available drivers and send ride request to them
      try {
        const pickupLat = pickupLocation.latitude;
        const pickupLng = pickupLocation.longitude;
        const radius = 10; // 10km radius

        // Find available drivers (verified or in development mode)
        // In development, auto-verification happens when driver goes online
        const drivers = await User.find({
          isDriver: true,
          'driverInfo.isAvailable': true,
          'driverInfo.currentLocation': { $exists: true }
        }).select('_id name driverInfo');

        console.log(`🔍 Found ${drivers.length} available drivers, checking proximity to pickup (${pickupLat}, ${pickupLng})...`);

        // Filter by distance and emit to each driver
        let driversNotified = 0;
        let driversTooFar = 0;
        drivers.forEach(driver => {
          if (!driver.driverInfo?.currentLocation) {
            console.log(`⚠️ Driver ${driver._id} has no location set`);
            return;
          }
          
          const driverLat = driver.driverInfo.currentLocation.latitude;
          const driverLng = driver.driverInfo.currentLocation.longitude;
          
          // Haversine formula to calculate distance
          const R = 6371; // Earth's radius in km
          const dLat = (driverLat - pickupLat) * Math.PI / 180;
          const dLng = (driverLng - pickupLng) * Math.PI / 180;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(pickupLat * Math.PI / 180) * Math.cos(driverLat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;
          
          // If driver is within radius, send them the ride request
          if (distance <= radius) {
            const driverRoom = `driver-${driver._id}`;
            console.log(`📤 Sending ride request to driver ${driver._id} (${driver.name}) in room ${driverRoom} (${distance.toFixed(2)}km away)`);
            io.to(driverRoom).emit('new-ride-request', ride.toObject());
            driversNotified++;
          } else {
            driversTooFar++;
            console.log(`⏭️ Driver ${driver._id} (${driver.name}) is too far: ${distance.toFixed(2)}km (radius: ${radius}km)`);
          }
        });

        console.log(`✅ Ride request sent to ${driversNotified} nearby driver(s)`);
        
        if (driversNotified === 0) {
          if (drivers.length === 0) {
            console.log(`⚠️ No available drivers found at all`);
          } else if (driversTooFar > 0) {
            console.log(`⚠️ ${driversTooFar} driver(s) found but all are outside ${radius}km radius`);
          } else {
            console.log(`⚠️ No drivers found within ${radius}km of pickup location`);
          }
        }
      } catch (error) {
        console.error('Error finding and notifying drivers:', error);
        // Don't fail the ride creation if driver notification fails
      }
    }

    res.status(201).json(ride);
  } catch (error) {
    console.error('Create ride error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/rides/:id
// @desc    Get a single ride by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate('rider', 'name email phone')
      .populate('driver', 'name email phone');

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    // Check if user has access to this ride
    if (req.user.role !== 'admin' && 
        ride.rider._id.toString() !== req.user.id && 
        ride.driver?._id?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(ride);
  } catch (error) {
    console.error('Get ride error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/rides/:id/accept
// @desc    Driver accepts a ride
// @access  Private (Driver only)
router.put('/:id/accept', protect, authorize('driver'), async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate('rider', 'name email phone')
      .populate('driver', 'name email phone');

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (ride.status !== 'pending') {
      return res.status(400).json({ message: 'Ride is not available' });
    }

    if (ride.driver) {
      return res.status(400).json({ message: 'Ride already has a driver' });
    }

    // Assign driver
    ride.driver = req.user.id;
    ride.status = 'accepted';
    await ride.save();

    // Populate driver info
    await ride.populate('driver', 'name email phone');

    const io = req.app.get('io');
    if (io) {
      // Emit to rider
      io.to(`ride-${ride._id}`).emit('trip-accepted', ride.toObject());
      io.to(`ride-${ride._id}`).emit('ride-status-update', {
        rideId: ride._id,
        status: ride.status,
        ride: ride.toObject()
      });

      // Emit to admin
      io.to('admin').emit('ride-updated', ride.toObject());

      // Notify other drivers that this ride is no longer available
      io.emit('trip-unavailable', { rideId: ride._id });
    }

    res.json(ride);
  } catch (error) {
    console.error('Accept ride error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/rides/:id/update-status
// @desc    Update ride status
// @access  Private
router.put('/:id/update-status', protect, [
  body('status').isIn(['accepted', 'driver_arrived', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid status'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;
    const ride = await Ride.findById(req.params.id)
      .populate('rider', 'name email phone')
      .populate('driver', 'name email phone');

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    // Check permissions
    const isDriver = ride.driver && ride.driver._id.toString() === req.user.id;
    const isRider = ride.rider._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isDriver && !isRider && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update status and timestamps
    ride.status = status;
    if (status === 'in_progress' && !ride.startedAt) {
      ride.startedAt = new Date();
    }
    if (status === 'completed' && !ride.completedAt) {
      ride.completedAt = new Date();
      // Calculate loyalty points (10 points per R10 spent)
      if (isRider && ride.rider) {
        const points = Math.floor((ride.finalFare || ride.fare) / 10) * 10;
        const rider = await User.findById(ride.rider._id);
        if (rider && rider.loyalty) {
          rider.loyalty.points = (rider.loyalty.points || 0) + points;
          rider.loyalty.lastActivity = new Date();
          await rider.save();
        }
      }
    }
    if (status === 'cancelled' && !ride.cancelledAt) {
      ride.cancelledAt = new Date();
    }

    await ride.save();

    const io = req.app.get('io');
    if (io) {
      const rideRoom = `ride-${ride._id}`;
      console.log(`📤 Emitting ride-status-update to ${rideRoom}:`, {
        rideId: ride._id,
        status: ride.status,
        roomMembers: io.sockets.adapter.rooms.get(rideRoom)?.size || 0
      });
      
      io.to(rideRoom).emit('ride-status-update', {
        rideId: ride._id,
        status: ride.status,
        ride: ride.toObject()
      });
      io.to('admin').emit('ride-updated', ride.toObject());
    }

    res.json(ride);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/rides/:id/cancel
// @desc    Cancel a ride
// @access  Private
router.put('/:id/cancel', protect, [
  body('reason').optional().isString(),
], async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate('rider', 'name email phone')
      .populate('driver', 'name email phone');

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    // Check permissions
    const isRider = ride.rider._id.toString() === req.user.id;
    const isDriver = ride.driver && ride.driver._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isRider && !isDriver && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (ride.status === 'completed') {
      return res.status(400).json({ message: 'Cannot cancel a completed ride' });
    }

    ride.status = 'cancelled';
    ride.cancelledAt = new Date();
    ride.cancellationReason = req.body.reason || 'Cancelled by user';
    await ride.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`ride-${ride._id}`).emit('ride-status-update', {
        rideId: ride._id,
        status: ride.status,
        ride: ride.toObject()
      });
      io.to('admin').emit('ride-updated', ride.toObject());
    }

    res.json(ride);
  } catch (error) {
    console.error('Cancel ride error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/rides/:id/rate
// @desc    Rate a completed ride
// @access  Private
router.put('/:id/rate', protect, [
  body('stars').isInt({ min: 1, max: 5 }).withMessage('Stars must be between 1 and 5'),
  body('suggestions').optional().isArray(),
  body('review').optional().isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { stars, suggestions = [], review = '' } = req.body;
    const ride = await Ride.findById(req.params.id)
      .populate('rider', 'name email phone')
      .populate('driver', 'name email phone');

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    // Only rider can rate driver
    if (ride.rider._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the rider can rate this ride' });
    }

    if (ride.status !== 'completed') {
      return res.status(400).json({ message: 'Can only rate completed rides' });
    }

    if (ride.rating?.rider?.stars) {
      return res.status(400).json({ message: 'Ride already rated' });
    }

    // Save rating
    ride.rating = {
      ...ride.rating,
      rider: {
        stars,
        suggestions,
        review
      }
    };
    await ride.save();

    // Update driver's average rating
    if (ride.driver) {
      const driver = await User.findById(ride.driver._id);
      if (driver) {
        // Get all completed rides with ratings for this driver
        const ratedRides = await Ride.find({
          driver: driver._id,
          status: 'completed',
          'rating.rider.stars': { $exists: true, $ne: null }
        });

        if (ratedRides.length > 0) {
          const totalStars = ratedRides.reduce((sum, r) => sum + (r.rating?.rider?.stars || 0), 0);
          driver.driverInfo = driver.driverInfo || {};
          driver.driverInfo.averageRating = totalStars / ratedRides.length;
          await driver.save();
        }
      }
    }

    res.json(ride);
  } catch (error) {
    console.error('Rate ride error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/rides/:id/generate-share-code
// @desc    Generate a share code for a ride
// @access  Private
router.post('/:id/generate-share-code', protect, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (ride.rider.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Generate unique share code
    const shareCode = `MZ${ride._id.toString().slice(-6).toUpperCase()}`;
    ride.shareCode = shareCode;
    await ride.save();

    res.json({ shareCode });
  } catch (error) {
    console.error('Generate share code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/rides/:id/start-recording
// @desc    Start recording a ride
// @access  Private
router.put('/:id/start-recording', protect, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (ride.rider.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    ride.recording = {
      enabled: true,
      startTime: new Date()
    };
    await ride.save();

    res.json({ message: 'Recording started', ride });
  } catch (error) {
    console.error('Start recording error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/rides/:id/stop-recording
// @desc    Stop recording a ride
// @access  Private
router.put('/:id/stop-recording', protect, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (ride.rider.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    ride.recording = {
      ...ride.recording,
      enabled: false,
      endTime: new Date()
    };
    await ride.save();

    res.json({ message: 'Recording stopped', ride });
  } catch (error) {
    console.error('Stop recording error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add split fare endpoint
// @route   POST /api/rides/:id/split-fare
// @desc    Split fare with other users
// @access  Private
router.post('/:id/split-fare', protect, [
  body('participants').isArray().withMessage('Participants must be an array'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { participants } = req.body;
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    // Check if user is the rider
    if (ride.rider.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the rider can split fare' });
    }

    if (ride.status !== 'completed') {
      return res.status(400).json({ message: 'Ride must be completed to split fare' });
    }

    const totalAmount = ride.finalFare || ride.fare;
    const amountPerPerson = totalAmount / (participants.length + 1); // +1 for the rider

    ride.splitFare = {
      enabled: true,
      participants: participants.map(p => ({
        user: p.userId,
        amount: amountPerPerson,
        paid: false
      })),
      totalAmount: totalAmount
    };

    await ride.save();

    res.json({
      message: 'Fare split created',
      splitFare: ride.splitFare
    });
  } catch (error) {
    console.error('Split fare error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add ride pooling endpoint
// @route   POST /api/rides/:id/pool
// @desc    Add rider to pooled ride
// @access  Private
router.post('/:id/pool', protect, [
  body('pickupLocation').notEmpty().withMessage('Pickup location is required'),
  body('dropoffLocation').notEmpty().withMessage('Dropoff location is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { pickupLocation, dropoffLocation } = req.body;
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (!ride.isPooled) {
      ride.isPooled = true;
    }

    // Calculate fare for this rider
    const fare = calculateFare(pickupLocation, dropoffLocation, ride.rideType);

    ride.poolRiders.push({
      rider: req.user.id,
      pickupLocation,
      dropoffLocation,
      fare: fare,
      joinedAt: new Date()
    });

    await ride.save();

    res.json({
      message: 'Joined pooled ride',
      ride: ride.toObject()
    });
  } catch (error) {
    console.error('Join pool error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
