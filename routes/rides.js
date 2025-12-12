const express = require('express');
const {
    body,
    validationResult
} = require('express-validator');
const Ride = require('../models/Ride');
const User = require('../models/User');
const {
    protect,
    authorize
} = require('../middleware/auth');
const axios = require('axios');
const {
    calculateDistance,
    calculateRideFare,
    formatDistance,
    formatEstimatedTime
} = require('../utils');

const router = express.Router();

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
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const {
            pickupLocation,
            dropoffLocation,
            rideType = 'economy',
            surgeMultiplier,
            promoDiscount
        } = req.body;

        // Calculate distance
        const distance = calculateDistance(pickupLocation, dropoffLocation);

        // Calculate fare with all factors
        const fareDetails = calculateRideFare(distance, rideType, {
            surgeMultiplier,
            promoDiscount
        });

        // Calculate estimated time
        const estimatedTime = calculateEstimatedTime(distance);

        res.json({
            fare: fareDetails.totalFare,
            fareDetails,
            distance: formatDistance(distance),
            estimatedTime: formatEstimatedTime(estimatedTime),
            rideType,
            currency: 'ZAR'
        });
    } catch (error) {
        console.error('Calculate fare error:', error);
        res.status(500).json({
            message: 'Server error'
        });
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
                .sort({
                    createdAt: -1
                });
        } else if (req.user.isDriver) {
            // Driver sees their rides
            rides = await Ride.find({
                    driver: req.user.id
                })
                .populate('rider', 'name email phone')
                .sort({
                    createdAt: -1
                });
        } else {
            // Rider sees their rides
            rides = await Ride.find({
                    rider: req.user.id
                })
                .populate('driver', 'name email phone')
                .sort({
                    createdAt: -1
                });
        }

        res.json(rides);
    } catch (error) {
        console.error('Get rides error:', error);
        res.status(500).json({
            message: 'Server error'
        });
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
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const {
            pickupLocation,
            dropoffLocation,
            rideType = 'economy',
            paymentMethod = 'card',
            distance
        } = req.body;

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
                const radius = 10; // 10km radius

                // Find available drivers (verified or in development mode)
                // In development, auto-verification happens when driver goes online
                const drivers = await User.find({
                    isDriver: true,
                    'driverInfo.isAvailable': true,
                    'driverInfo.currentLocation': {
                        $exists: true
                    }
                }).select('_id name driverInfo');

                console.log(`🔍 Found ${drivers.length} available drivers, checking proximity to pickup...`);

                // Log all active driver rooms for debugging
                const allDriverRooms = Array.from(io.sockets.adapter.rooms.keys()).filter(r => r.startsWith('driver-'));
                console.log(`📋 Active driver rooms: ${allDriverRooms.length}`);
                if (allDriverRooms.length > 0) {
                    allDriverRooms.forEach(room => {
                        const members = io.sockets.adapter.rooms.get(room);
                        console.log(`   - ${room}: ${members?.size || 0} socket(s)`);
                    });
                }

                // Filter by distance and emit to each driver
                let driversNotified = 0;
                let driversTooFar = 0;
                let driversNotInRoom = 0;
                drivers.forEach(driver => {
                    if (!driver.driverInfo ? .currentLocation) {
                        console.log(`⚠️ Driver ${driver._id} has no location set`);
                        return;
                    }

                    // Calculate distance using utility function
                    const driverDistance = calculateDistance(
                        pickupLocation,
                        driver.driverInfo.currentLocation
                    );

                    // If driver is within radius, send them the ride request
                    if (driverDistance <= radius) {
                        // Ensure driver ID is consistently a string
                        const driverId = String(driver._id);
                        const driverRoom = `driver-${driverId}`;

                        // Verify driver is actually in the socket room before sending
                        const roomMembers = io.sockets.adapter.rooms.get(driverRoom);
                        const isDriverInRoom = roomMembers && roomMembers.size > 0;

                        if (isDriverInRoom) {
                            console.log(`📤 Sending ride request to driver ${driverId} (${driver.name}) in room ${driverRoom} (${formatDistance(driverDistance)} away, ${roomMembers.size} socket(s) in room)`);
                            io.to(driverRoom).emit('new-ride-request', ride.toObject());
                            driversNotified++;
                        } else {
                            driversNotInRoom++;
                            console.log(`⚠️ Driver ${driverId} (${driver.name}) is available but NOT in socket room ${driverRoom} - request NOT sent`);
                            console.log(`   💡 Driver may have disconnected or not joined the room yet`);
                            console.log(`   💡 Check if driver socket is connected and has joined room`);
                            console.log(`   💡 Expected room: ${driverRoom}`);
                            console.log(`   💡 Available rooms: ${allDriverRooms.join(', ') || 'none'}`);

                            // Try alternative room formats (in case of ID format mismatch)
                            const altRoom1 = `driver-${driver._id}`;
                            const altRoom2 = `driver-${driver._id.toString()}`;
                            const altRoomMembers1 = io.sockets.adapter.rooms.get(altRoom1);
                            const altRoomMembers2 = io.sockets.adapter.rooms.get(altRoom2);

                            if (altRoomMembers1 && altRoomMembers1.size > 0) {
                                console.log(`   🔍 Found driver in alternative room format: ${altRoom1}`);
                            }
                            if (altRoomMembers2 && altRoomMembers2.size > 0) {
                                console.log(`   🔍 Found driver in alternative room format: ${altRoom2}`);
                            }
                        }
                    } else {
                        driversTooFar++;
                        console.log(`⏭️ Driver ${driver._id} (${driver.name}) is too far: ${formatDistance(driverDistance)} (radius: ${radius}km)`);
                    }
                });

                console.log(`✅ Ride request sent to ${driversNotified} nearby driver(s)`);
                console.log(`📊 Summary: ${driversNotified} notified, ${driversTooFar} too far, ${driversNotInRoom} not in socket room`);

                if (driversNotified === 0) {
                    if (drivers.length === 0) {
                        console.log(`⚠️ No available drivers found at all`);
                        console.log(`   💡 Check: Driver must toggle "Go Online" and have location set`);
                    } else if (driversNotInRoom > 0) {
                        console.log(`⚠️ ${driversNotInRoom} driver(s) found but NOT connected to socket`);
                        console.log(`   💡 Driver needs to: 1) Connect socket 2) Join driver room 3) Toggle "Go Online"`);
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
        res.status(500).json({
            message: 'Server error'
        });
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
            return res.status(404).json({
                message: 'Ride not found'
            });
        }

        // Check if user has access to this ride
        if (req.user.role !== 'admin' &&
            ride.rider._id.toString() !== req.user.id &&
            ride.driver ? ._id ? .toString() !== req.user.id) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        res.json(ride);
    } catch (error) {
        console.error('Get ride error:', error);
        res.status(500).json({
            message: 'Server error'
        });
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
            console.log(`❌ Ride not found: ${req.params.id}`);
            return res.status(404).json({
                message: 'Ride not found'
            });
        }

        // Check if this driver already accepted this ride (handle duplicate requests)
        if (ride.driver && ride.driver._id.toString() === req.user.id.toString()) {
            console.log(`✅ Driver ${req.user.id} already accepted ride ${ride._id}`);
            return res.json(ride);
        }

        // Check if ride already has a different driver
        if (ride.driver && ride.driver._id.toString() !== req.user.id.toString()) {
            console.log(`⚠️ Ride ${ride._id} already has driver ${ride.driver._id}, rejecting driver ${req.user.id}`);
            return res.status(400).json({
                message: 'Ride already has a driver',
                currentStatus: ride.status,
                currentDriver: ride.driver._id.toString()
            });
        }

        // Check ride status with more specific error messages
        if (ride.status !== 'pending') {
            console.log(`⚠️ Ride ${ride._id} is not available. Status: ${ride.status}, Driver: ${ride.driver?._id || 'none'}`);

            let errorMessage = 'Ride is not available';
            if (ride.status === 'accepted') {
                errorMessage = 'Ride has already been accepted by another driver';
            } else if (ride.status === 'cancelled') {
                errorMessage = 'Ride has been cancelled';
            } else if (ride.status === 'completed') {
                errorMessage = 'Ride has already been completed';
            } else if (ride.status === 'in_progress') {
                errorMessage = 'Ride is already in progress';
            }

            return res.status(400).json({
                message: errorMessage,
                currentStatus: ride.status,
                rideId: ride._id.toString()
            });
        }

        // Assign driver
        ride.driver = req.user.id;
        ride.status = 'accepted';
        await ride.save();

        console.log(`✅ Driver ${req.user.id} accepted ride ${ride._id}`);

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
            io.emit('trip-unavailable', {
                rideId: ride._id
            });

            console.log(`📤 Emitted trip-accepted and trip-unavailable for ride ${ride._id}`);
        }

        res.json(ride);
    } catch (error) {
        console.error('Accept ride error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
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
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const {
            status
        } = req.body;
        const ride = await Ride.findById(req.params.id)
            .populate('rider', 'name email phone')
            .populate('driver', 'name email phone');

        if (!ride) {
            return res.status(404).json({
                message: 'Ride not found'
            });
        }

        // Check permissions
        const isDriver = ride.driver && ride.driver._id.toString() === req.user.id;
        const isRider = ride.rider._id.toString() === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isDriver && !isRider && !isAdmin) {
            return res.status(403).json({
                message: 'Access denied'
            });
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
                roomMembers: io.sockets.adapter.rooms.get(rideRoom) ? .size || 0
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
        res.status(500).json({
            message: 'Server error'
        });
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
            return res.status(404).json({
                message: 'Ride not found'
            });
        }

        // Check permissions
        const isRider = ride.rider._id.toString() === req.user.id;
        const isDriver = ride.driver && ride.driver._id.toString() === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isRider && !isDriver && !isAdmin) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        if (ride.status === 'completed') {
            return res.status(400).json({
                message: 'Cannot cancel a completed ride'
            });
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
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// @route   PUT /api/rides/:id/rate
// @desc    Rate a completed ride
// @access  Private
router.put('/:id/rate', protect, [
    body('stars').isInt({
        min: 1,
        max: 5
    }).withMessage('Stars must be between 1 and 5'),
    body('suggestions').optional().isArray(),
    body('review').optional().isString(),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const {
            stars,
            suggestions = [],
            review = ''
        } = req.body;
        const ride = await Ride.findById(req.params.id)
            .populate('rider', 'name email phone')
            .populate('driver', 'name email phone');

        if (!ride) {
            return res.status(404).json({
                message: 'Ride not found'
            });
        }

        // Only rider can rate driver
        if (ride.rider._id.toString() !== req.user.id) {
            return res.status(403).json({
                message: 'Only the rider can rate this ride'
            });
        }

        if (ride.status !== 'completed') {
            return res.status(400).json({
                message: 'Can only rate completed rides'
            });
        }

        if (ride.rating ? .rider ? .stars) {
            return res.status(400).json({
                message: 'Ride already rated'
            });
        }

        // Save rating - preserve existing driver rating if it exists
        // Initialize rating object if it doesn't exist
        if (!ride.rating) {
            ride.rating = {};
        }

        // Set rider rating
        ride.rating.rider = {
            stars,
            suggestions,
            review
        };

        // Preserve driver rating if it exists and is a valid object, otherwise ensure it's an empty object
        if (!ride.rating.driver || typeof ride.rating.driver !== 'object' || Array.isArray(ride.rating.driver)) {
            ride.rating.driver = {};
        }
        // If driver rating exists, preserve it (don't overwrite)

        await ride.save();

        // Update driver's average rating
        if (ride.driver) {
            const driver = await User.findById(ride.driver._id);
            if (driver) {
                // Get all completed rides with ratings for this driver
                const ratedRides = await Ride.find({
                    driver: driver._id,
                    status: 'completed',
                    'rating.rider.stars': {
                        $exists: true,
                        $ne: null
                    }
                });

                if (ratedRides.length > 0) {
                    const totalStars = ratedRides.reduce((sum, r) => sum + (r.rating ? .rider ? .stars || 0), 0);
                    driver.driverInfo = driver.driverInfo || {};
                    driver.driverInfo.averageRating = totalStars / ratedRides.length;
                    await driver.save();
                }
            }
        }

        res.json(ride);
    } catch (error) {
        console.error('Rate ride error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// @route   POST /api/rides/:id/generate-share-code
// @desc    Generate a share code for a ride
// @access  Private
router.post('/:id/generate-share-code', protect, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);

        if (!ride) {
            return res.status(404).json({
                message: 'Ride not found'
            });
        }

        if (ride.rider.toString() !== req.user.id) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        // Generate unique share code
        const shareCode = `MZ${ride._id.toString().slice(-6).toUpperCase()}`;
        ride.shareCode = shareCode;
        await ride.save();

        res.json({
            shareCode
        });
    } catch (error) {
        console.error('Generate share code error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// @route   PUT /api/rides/:id/start-recording
// @desc    Start recording a ride
// @access  Private
router.put('/:id/start-recording', protect, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);

        if (!ride) {
            return res.status(404).json({
                message: 'Ride not found'
            });
        }

        if (ride.rider.toString() !== req.user.id) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        ride.recording = {
            enabled: true,
            startTime: new Date()
        };
        await ride.save();

        res.json({
            message: 'Recording started',
            ride
        });
    } catch (error) {
        console.error('Start recording error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// @route   PUT /api/rides/:id/stop-recording
// @desc    Stop recording a ride
// @access  Private
router.put('/:id/stop-recording', protect, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);

        if (!ride) {
            return res.status(404).json({
                message: 'Ride not found'
            });
        }

        if (ride.rider.toString() !== req.user.id) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        ride.recording = {
            ...ride.recording,
            enabled: false,
            endTime: new Date()
        };
        await ride.save();

        res.json({
            message: 'Recording stopped',
            ride
        });
    } catch (error) {
        console.error('Stop recording error:', error);
        res.status(500).json({
            message: 'Server error'
        });
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
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const {
            participants
        } = req.body;
        const ride = await Ride.findById(req.params.id);

        if (!ride) {
            return res.status(404).json({
                message: 'Ride not found'
            });
        }

        // Check if user is the rider
        if (ride.rider.toString() !== req.user.id) {
            return res.status(403).json({
                message: 'Only the rider can split fare'
            });
        }

        if (ride.status !== 'completed') {
            return res.status(400).json({
                message: 'Ride must be completed to split fare'
            });
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
        res.status(500).json({
            message: 'Server error'
        });
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
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const {
            pickupLocation,
            dropoffLocation
        } = req.body;
        const ride = await Ride.findById(req.params.id);

        if (!ride) {
            return res.status(404).json({
                message: 'Ride not found'
            });
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
        res.status(500).json({
            message: 'Server error'
        });
    }
});

module.exports = router;