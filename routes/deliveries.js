const express = require('express');
const {
    body,
    validationResult
} = require('express-validator');
const Delivery = require('../models/Delivery');
const User = require('../models/User');
const {
    protect,
    authorize
} = require('../middleware/auth');
const {
    calculateDistance,
    calculateDeliveryFare,
    formatDistance,
    formatEstimatedTime
} = require('../utils');

const router = express.Router();

// @route   POST /api/deliveries/calculate-fare
// @desc    Calculate fare for a delivery
// @access  Private
router.post('/calculate-fare', protect, [
    body('pickupLocation').notEmpty().withMessage('Pickup location is required'),
    body('deliveryLocation').notEmpty().withMessage('Delivery location is required'),
    body('deliveryType').optional().isIn(['standard', 'express', 'scheduled']).withMessage('Invalid delivery type'),
    body('itemWeight').optional().isNumeric().withMessage('Item weight must be a number'),
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
            deliveryLocation,
            deliveryType = 'standard',
            itemWeight = 0,
            isFragile,
            itemValue,
            promoDiscount
        } = req.body;

        // Calculate distance
        const distance = calculateDistance(pickupLocation, deliveryLocation);

        // Calculate fare with all factors
        const fareDetails = calculateDeliveryFare(distance, deliveryType, itemWeight, {
            isFragile,
            itemValue,
            promoDiscount
        });

        // Calculate estimated time
        const estimatedTime = calculateEstimatedTime(distance, deliveryType === 'express' ? 60 : 50);

        res.json({
            fare: fareDetails.totalFare,
            fareDetails,
            distance: formatDistance(distance),
            estimatedTime: formatEstimatedTime(estimatedTime),
            deliveryType,
            currency: 'ZAR'
        });
    } catch (error) {
        console.error('Calculate delivery fare error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// @route   GET /api/deliveries
// @desc    Get all deliveries for the authenticated user (customer or courier) or all deliveries for admin
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        let deliveries;

        // Admin can see all deliveries
        if (req.user.role === 'admin') {
            deliveries = await Delivery.find()
                .populate('customer', 'name email phone')
                .populate('courier', 'name email phone')
                .sort({
                    createdAt: -1
                });
        } else if (req.user.isCourier) {
            // Courier sees their deliveries
            deliveries = await Delivery.find({
                    courier: req.user.id
                })
                .populate('customer', 'name email phone')
                .sort({
                    createdAt: -1
                });
        } else {
            // Customer sees their deliveries
            deliveries = await Delivery.find({
                    customer: req.user.id
                })
                .populate('courier', 'name email phone')
                .sort({
                    createdAt: -1
                });
        }

        res.json(deliveries);
    } catch (error) {
        console.error('Get deliveries error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// @route   POST /api/deliveries
// @desc    Create a new delivery request
// @access  Private
router.post('/', protect, [
    body('pickupLocation').notEmpty().withMessage('Pickup location is required'),
    body('deliveryLocation').notEmpty().withMessage('Delivery location is required'),
    body('itemDescription').notEmpty().withMessage('Item description is required'),
    body('deliveryType').optional().isIn(['standard', 'express', 'scheduled']).withMessage('Invalid delivery type'),
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
            deliveryLocation,
            itemDescription,
            itemWeight = 0,
            itemValue = 0,
            deliveryType = 'standard',
            priority = 'normal',
            paymentMethod = 'card',
            specialInstructions,
            recipientName,
            recipientPhone,
            requiresSignature = false,
            scheduledFor,
            distance
        } = req.body;

        // Calculate fare
        const fare = calculateDeliveryFare(pickupLocation, deliveryLocation, deliveryType, itemWeight);

        // Create delivery
        const delivery = new Delivery({
            customer: req.user.id,
            pickupLocation,
            deliveryLocation,
            itemDescription,
            itemWeight,
            itemValue,
            deliveryType,
            priority,
            paymentMethod,
            specialInstructions,
            recipientName,
            recipientPhone,
            requiresSignature,
            fare,
            distance: distance || 0,
            status: 'pending',
            scheduledFor: scheduledFor || null,
            isScheduled: !!scheduledFor
        });

        await delivery.save();

        // Populate customer info
        await delivery.populate('customer', 'name email phone');

        // Emit to admin room for real-time updates
        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('new-delivery', delivery.toObject());

            // Find nearby available couriers and send delivery request to them
            try {
                const pickupLat = pickupLocation.latitude;
                const pickupLng = pickupLocation.longitude;
                const radius = 10; // 10km radius

                // Find available couriers
                const couriers = await User.find({
                    isCourier: true,
                    'courierInfo.isAvailable': true,
                    'courierInfo.currentLocation': {
                        $exists: true
                    }
                }).select('_id name courierInfo');

                console.log(`🔍 Found ${couriers.length} available couriers, checking proximity to pickup (${pickupLat}, ${pickupLng})...`);

                // Filter by distance and emit to each courier
                let couriersNotified = 0;
                couriers.forEach(courier => {
                    if (!courier.courierInfo?.currentLocation) {
                        return;
                    }

                    const courierLat = courier.courierInfo.currentLocation.latitude;
                    const courierLng = courier.courierInfo.currentLocation.longitude;

                    // Haversine formula to calculate distance
                    const R = 6371; // Earth's radius in km
                    const dLat = (courierLat - pickupLat) * Math.PI / 180;
                    const dLng = (courierLng - pickupLng) * Math.PI / 180;
                    const a =
                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(pickupLat * Math.PI / 180) * Math.cos(courierLat * Math.PI / 180) *
                        Math.sin(dLng / 2) * Math.sin(dLng / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    const distance = R * c;

                    // If courier is within radius, send them the delivery request
                    if (distance <= radius) {
                        const courierRoom = `courier-${courier._id}`;
                        const roomMembers = io.sockets.adapter.rooms.get(courierRoom);
                        const isCourierInRoom = roomMembers && roomMembers.size > 0;

                        if (isCourierInRoom) {
                            console.log(`📤 Sending delivery request to courier ${courier._id} (${courier.name}) in room ${courierRoom} (${distance.toFixed(2)}km away)`);
                            io.to(courierRoom).emit('new-delivery-request', delivery.toObject());
                            couriersNotified++;
                        }
                    }
                });

                console.log(`✅ Delivery request sent to ${couriersNotified} nearby courier(s)`);
            } catch (error) {
                console.error('Error finding and notifying couriers:', error);
                // Don't fail the delivery creation if courier notification fails
            }
        }

        res.status(201).json(delivery);
    } catch (error) {
        console.error('Create delivery error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// @route   GET /api/deliveries/:id
// @desc    Get a single delivery by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const delivery = await Delivery.findById(req.params.id)
            .populate('customer', 'name email phone')
            .populate('courier', 'name email phone');

        if (!delivery) {
            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        // Check if user has access to this delivery
        if (req.user.role !== 'admin' &&
            delivery.customer._id.toString() !== req.user.id &&
            delivery.courier?._id?.toString() !== req.user.id) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        res.json(delivery);
    } catch (error) {
        console.error('Get delivery error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// @route   PUT /api/deliveries/:id/accept
// @desc    Courier accepts a delivery
// @access  Private (Courier only)
router.put('/:id/accept', protect, async (req, res) => {
    try {
        // Check if user is a courier
        if (!req.user.isCourier) {
            return res.status(403).json({
                message: 'Only couriers can accept deliveries'
            });
        }

        const delivery = await Delivery.findById(req.params.id)
            .populate('customer', 'name email phone')
            .populate('courier', 'name email phone');

        if (!delivery) {
            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        // Check if delivery already has a courier
        if (delivery.courier && delivery.courier._id.toString() !== req.user.id.toString()) {
            return res.status(400).json({
                message: 'Delivery already has a courier',
                currentStatus: delivery.status,
                currentCourier: delivery.courier._id.toString()
            });
        }

        // Check delivery status
        if (delivery.status !== 'pending') {
            return res.status(400).json({
                message: 'Delivery is not available',
                currentStatus: delivery.status
            });
        }

        // Assign courier
        delivery.courier = req.user.id;
        delivery.status = 'accepted';
        await delivery.save();

        // Populate courier info
        await delivery.populate('courier', 'name email phone');

        const io = req.app.get('io');
        if (io) {
            // Emit to customer
            io.to(`delivery-${delivery._id}`).emit('delivery-accepted', delivery.toObject());
            io.to(`delivery-${delivery._id}`).emit('delivery-status-update', {
                deliveryId: delivery._id,
                status: delivery.status,
                delivery: delivery.toObject()
            });

            // Emit to admin
            io.to('admin').emit('delivery-updated', delivery.toObject());

            // Notify other couriers that this delivery is no longer available
            io.emit('delivery-unavailable', {
                deliveryId: delivery._id
            });
        }

        res.json(delivery);
    } catch (error) {
        console.error('Accept delivery error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   PUT /api/deliveries/:id/update-status
// @desc    Update delivery status
// @access  Private
router.put('/:id/update-status', protect, [
    body('status').isIn(['accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled']).withMessage('Invalid status'),
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
        const delivery = await Delivery.findById(req.params.id)
            .populate('customer', 'name email phone')
            .populate('courier', 'name email phone');

        if (!delivery) {
            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        // Check permissions
        const isCourier = delivery.courier && delivery.courier._id.toString() === req.user.id;
        const isCustomer = delivery.customer._id.toString() === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isCourier && !isCustomer && !isAdmin) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        // Update status and timestamps
        delivery.status = status;
        if (status === 'picked_up' && !delivery.pickedUpAt) {
            delivery.pickedUpAt = new Date();
        }
        if (status === 'delivered' && !delivery.deliveredAt) {
            delivery.deliveredAt = new Date();
            // Calculate loyalty points (10 points per R10 spent)
            if (isCustomer && delivery.customer) {
                const points = Math.floor((delivery.finalFare || delivery.fare) / 10) * 10;
                const customer = await User.findById(delivery.customer._id);
                if (customer && customer.loyalty) {
                    customer.loyalty.points = (customer.loyalty.points || 0) + points;
                    customer.loyalty.lastActivity = new Date();
                    await customer.save();
                }
            }
        }
        if (status === 'cancelled' && !delivery.cancelledAt) {
            delivery.cancelledAt = new Date();
        }

        await delivery.save();

        const io = req.app.get('io');
        if (io) {
            const deliveryRoom = `delivery-${delivery._id}`;
            io.to(deliveryRoom).emit('delivery-status-update', {
                deliveryId: delivery._id,
                status: delivery.status,
                delivery: delivery.toObject()
            });
            io.to('admin').emit('delivery-updated', delivery.toObject());
        }

        res.json(delivery);
    } catch (error) {
        console.error('Update delivery status error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// @route   PUT /api/deliveries/:id/cancel
// @desc    Cancel a delivery
// @access  Private
router.put('/:id/cancel', protect, [
    body('reason').optional().isString(),
], async (req, res) => {
    try {
        const delivery = await Delivery.findById(req.params.id)
            .populate('customer', 'name email phone')
            .populate('courier', 'name email phone');

        if (!delivery) {
            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        // Check permissions
        const isCustomer = delivery.customer._id.toString() === req.user.id;
        const isCourier = delivery.courier && delivery.courier._id.toString() === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isCustomer && !isCourier && !isAdmin) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        if (delivery.status === 'delivered') {
            return res.status(400).json({
                message: 'Cannot cancel a delivered delivery'
            });
        }

        delivery.status = 'cancelled';
        delivery.cancelledAt = new Date();
        delivery.cancellationReason = req.body.reason || 'Cancelled by user';
        await delivery.save();

        const io = req.app.get('io');
        if (io) {
            io.to(`delivery-${delivery._id}`).emit('delivery-status-update', {
                deliveryId: delivery._id,
                status: delivery.status,
                delivery: delivery.toObject()
            });
            io.to('admin').emit('delivery-updated', delivery.toObject());
        }

        res.json(delivery);
    } catch (error) {
        console.error('Cancel delivery error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// @route   PUT /api/deliveries/:id/rate
// @desc    Rate a completed delivery
// @access  Private
router.put('/:id/rate', protect, [
    body('stars').isInt({
        min: 1,
        max: 5
    }).withMessage('Stars must be between 1 and 5'),
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
            review = ''
        } = req.body;
        const delivery = await Delivery.findById(req.params.id)
            .populate('customer', 'name email phone')
            .populate('courier', 'name email phone');

        if (!delivery) {
            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        // Only customer can rate courier
        if (delivery.customer._id.toString() !== req.user.id) {
            return res.status(403).json({
                message: 'Only the customer can rate this delivery'
            });
        }

        if (delivery.status !== 'delivered') {
            return res.status(400).json({
                message: 'Can only rate delivered deliveries'
            });
        }

        if (delivery.rating?.customer?.stars) {
            return res.status(400).json({
                message: 'Delivery already rated'
            });
        }

        // Initialize rating object if it doesn't exist
        if (!delivery.rating) {
            delivery.rating = {};
        }

        delivery.rating.customer = {
            stars,
            review
        };

        await delivery.save();

        // Update courier's average rating
        if (delivery.courier) {
            const courier = await User.findById(delivery.courier._id);
            if (courier) {
                const ratedDeliveries = await Delivery.find({
                    courier: courier._id,
                    status: 'delivered',
                    'rating.customer.stars': {
                        $exists: true,
                        $ne: null
                    }
                });

                if (ratedDeliveries.length > 0) {
                    const totalStars = ratedDeliveries.reduce((sum, d) => sum + (d.rating?.customer?.stars || 0), 0);
                    courier.courierInfo = courier.courierInfo || {};
                    courier.courierInfo.averageRating = totalStars / ratedDeliveries.length;
                    await courier.save();
                }
            }
        }

        res.json(delivery);
    } catch (error) {
        console.error('Rate delivery error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// @route   PUT /api/deliveries/:id/courier-location
// @desc    Update courier location during delivery
// @access  Private (Courier only)
router.put('/:id/courier-location', protect, [
    body('latitude').isFloat().withMessage('Valid latitude is required'),
    body('longitude').isFloat().withMessage('Valid longitude is required'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        if (!req.user.isCourier) {
            return res.status(403).json({
                message: 'Only couriers can update location'
            });
        }

        const {
            latitude,
            longitude
        } = req.body;
        const delivery = await Delivery.findById(req.params.id);

        if (!delivery) {
            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        if (delivery.courier?.toString() !== req.user.id) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        delivery.courierLocation = {
            latitude,
            longitude,
            timestamp: new Date()
        };

        await delivery.save();

        const io = req.app.get('io');
        if (io) {
            io.to(`delivery-${delivery._id}`).emit('delivery-location-update', {
                deliveryId: delivery._id,
                location: delivery.courierLocation
            });
        }

        res.json(delivery);
    } catch (error) {
        console.error('Update courier location error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// @route   POST /api/deliveries/:id/photo
// @desc    Upload photo proof for delivery
// @access  Private (Courier only)
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/deliveries';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, {
                recursive: true
            });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `delivery-${req.params.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

router.post('/:id/photo', protect, upload.single('photo'), async (req, res) => {
    try {
        if (!req.user.isCourier) {
            return res.status(403).json({
                message: 'Only couriers can upload photos'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                message: 'No photo uploaded'
            });
        }

        const delivery = await Delivery.findById(req.params.id);

        if (!delivery) {
            // Delete uploaded file if delivery not found
            if (req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        if (delivery.courier?.toString() !== req.user.id) {
            // Delete uploaded file if access denied
            if (req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        const photoUrl = `/uploads/deliveries/${req.file.filename}`;
        const photoType = req.body.type || 'delivery';

        if (!delivery.photoProof) {
            delivery.photoProof = [];
        }

        delivery.photoProof.push({
            url: photoUrl,
            timestamp: new Date(),
            type: photoType
        });

        await delivery.save();

        const io = req.app.get('io');
        if (io) {
            io.to(`delivery-${delivery._id}`).emit('delivery-status-update', {
                deliveryId: delivery._id,
                status: delivery.status,
                delivery: delivery.toObject()
            });
        }

        res.json(delivery);
    } catch (error) {
        console.error('Upload photo error:', error);
        // Delete uploaded file on error
        if (req.file && req.file.path) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            message: 'Server error'
        });
    }
});

module.exports = router;
