const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const rideRoutes = require('./routes/rides');
const deliveryRoutes = require('./routes/deliveries');
const userRoutes = require('./routes/users');
const placesRoutes = require('./routes/places');
const promoRoutes = require('./routes/promo');
const voiceRoutes = require('./routes/voice');
const securityRoutes = require('./routes/security');
const chatRoutes = require('./routes/chat');
const loyaltyRoutes = require('./routes/loyalty');
const verificationRoutes = require('./routes/verification');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000
});

// Connect to database (non-blocking in development)
connectDB().then(connected => {
  if (!connected && process.env.NODE_ENV !== 'production') {
    console.log('⚠️  Server starting without database connection (development mode)');
    console.log('   Start MongoDB or update MONGODB_URI to connect');
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mzansi API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/loyalty', loyaltyRoutes.router);
app.use('/api/verification', verificationRoutes);

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  console.log('   Transport:', socket.conn.transport.name);
  console.log('   Socket auth:', socket.handshake.auth || 'none');

  // Handle driver joining their driver room
  // IMPORTANT: Only drivers should join driver rooms - ride requests are ONLY sent here
  socket.on('join', (room) => {
    if (typeof room === 'string') {
      if (room.startsWith('driver-')) {
        socket.join(room);
        const driverId = room.replace('driver-', '');
        console.log(`✅ Driver joined room: ${room} (socket: ${socket.id}, driverId: ${driverId}) - Ride requests will be sent here ONLY`);
        
        // Verify room membership after a short delay to ensure join is complete
        setTimeout(async () => {
          const roomMembers = io.sockets.adapter.rooms.get(room);
          if (roomMembers) {
            console.log(`📊 Room ${room} now has ${roomMembers.size} member(s)`);
            console.log(`   Socket IDs in room:`, Array.from(roomMembers));
            
            // Verify this specific socket is in the room
            if (roomMembers.has(socket.id)) {
              console.log(`   ✅ Socket ${socket.id} confirmed in room ${room}`);
              
              // Check for pending rides when driver joins room
              try {
                const User = require('./models/User');
                const Ride = require('./models/Ride');
                const user = await User.findById(driverId);
                
                if (user && user.driverInfo?.isAvailable && user.driverInfo?.currentLocation) {
                  console.log(`🔍 Driver ${driverId} is available with location - checking for pending rides...`);
                  
                  const radius = 10; // 10km radius
                  const driverLat = user.driverInfo.currentLocation.latitude;
                  const driverLng = user.driverInfo.currentLocation.longitude;

                  // Find pending rides
                  const pendingRides = await Ride.find({
                    status: 'pending',
                    driver: { $exists: false }
                  }).populate('rider', 'name email phone').sort({ createdAt: -1 });

                  console.log(`   Found ${pendingRides.length} pending ride(s)`);

                  if (pendingRides.length > 0) {
                    let ridesNotified = 0;
                    let ridesTooFar = 0;

                    pendingRides.forEach(ride => {
                      if (!ride.pickupLocation) return;

                      const pickupLat = ride.pickupLocation.latitude;
                      const pickupLng = ride.pickupLocation.longitude;

                      // Calculate distance
                      const R = 6371;
                      const dLat = (pickupLat - driverLat) * Math.PI / 180;
                      const dLng = (pickupLng - driverLng) * Math.PI / 180;
                      const a = 
                        Math.sin(dLat/2) * Math.sin(dLat/2) +
                        Math.cos(driverLat * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) *
                        Math.sin(dLng/2) * Math.sin(dLng/2);
                      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                      const distance = R * c;

                      if (distance <= radius) {
                        console.log(`📤 Sending pending ride ${ride._id} to driver ${driverId} (${distance.toFixed(2)}km away)`);
                        io.to(room).emit('new-ride-request', ride.toObject());
                        ridesNotified++;
                      } else {
                        ridesTooFar++;
                      }
                    });

                    console.log(`✅ Sent ${ridesNotified} pending ride(s) to driver ${driverId} (${ridesTooFar} too far)`);
                  }
                }
              } catch (error) {
                console.error('Error checking pending rides on room join:', error);
              }
            } else {
              console.warn(`   ⚠️ Socket ${socket.id} NOT found in room ${room} - this is a problem!`);
            }
          } else {
            console.warn(`⚠️ Room ${room} was created but has no members - this shouldn't happen`);
          }
        }, 1000); // Increased delay to ensure room join is complete
        
        // Log all current driver rooms for debugging
        const allRooms = Array.from(io.sockets.adapter.rooms.keys()).filter(r => r.startsWith('driver-'));
        console.log(`📋 Total driver rooms active: ${allRooms.length}`);
      } else if (room.startsWith('courier-')) {
        socket.join(room);
        const courierId = room.replace('courier-', '');
        console.log(`✅ Courier joined room: ${room} (socket: ${socket.id}, courierId: ${courierId}) - Delivery requests will be sent here`);
        
        // Verify room membership after a short delay to ensure join is complete
        setTimeout(async () => {
          const roomMembers = io.sockets.adapter.rooms.get(room);
          if (roomMembers) {
            console.log(`📊 Room ${room} now has ${roomMembers.size} member(s)`);
            console.log(`   Socket IDs in room:`, Array.from(roomMembers));
            
            // Verify this specific socket is in the room
            if (roomMembers.has(socket.id)) {
              console.log(`   ✅ Socket ${socket.id} confirmed in room ${room}`);
              
              // Check for pending deliveries when courier joins room
              try {
                const User = require('./models/User');
                const Delivery = require('./models/Delivery');
                const user = await User.findById(courierId);
                
                if (user && user.courierInfo?.isAvailable && user.courierInfo?.currentLocation) {
                  console.log(`🔍 Courier ${courierId} is available with location - checking for pending deliveries...`);
                  
                  const radius = 10; // 10km radius
                  const courierLat = user.courierInfo.currentLocation.latitude;
                  const courierLng = user.courierInfo.currentLocation.longitude;

                  // Find pending deliveries
                  const pendingDeliveries = await Delivery.find({
                    status: 'pending',
                    courier: { $exists: false }
                  }).populate('customer', 'name email phone').sort({ createdAt: -1 });

                  console.log(`   Found ${pendingDeliveries.length} pending delivery/deliveries`);

                  if (pendingDeliveries.length > 0) {
                    let deliveriesNotified = 0;
                    let deliveriesTooFar = 0;

                    pendingDeliveries.forEach(delivery => {
                      if (!delivery.pickupLocation) {
                        return;
                      }

                      const pickupLat = delivery.pickupLocation.latitude;
                      const pickupLng = delivery.pickupLocation.longitude;

                      // Haversine formula to calculate distance
                      const R = 6371; // Earth's radius in km
                      const dLat = (pickupLat - courierLat) * Math.PI / 180;
                      const dLng = (pickupLng - courierLng) * Math.PI / 180;
                      const a =
                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(courierLat * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) *
                        Math.sin(dLng / 2) * Math.sin(dLng / 2);
                      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                      const distance = R * c;

                      if (distance <= radius) {
                        console.log(`   📦 Sending pending delivery ${delivery._id} to courier (${distance.toFixed(2)}km away)`);
                        socket.emit('new-delivery-request', delivery.toObject());
                        deliveriesNotified++;
                      } else {
                        deliveriesTooFar++;
                      }
                    });

                    console.log(`   ✅ Notified courier about ${deliveriesNotified} nearby delivery/deliveries`);
                    if (deliveriesTooFar > 0) {
                      console.log(`   ⚠️ ${deliveriesTooFar} delivery/deliveries too far away (>${radius}km)`);
                    }
                  }
                }
              } catch (error) {
                console.error('Error checking pending deliveries for courier:', error);
              }
            }
          }
        }, 500);
      } else if (room === 'admin') {
        // Admin room for dashboard updates
        socket.join('admin');
        console.log(`✅ Admin joined admin room (socket: ${socket.id})`);
      } else {
        console.warn(`⚠️ Invalid room join attempt: ${room} (socket: ${socket.id})`);
      }
    }
  });

  // Handle joining a ride room (for riders and drivers tracking a ride)
  socket.on('join-ride', (rideId) => {
    const rideRoom = `ride-${rideId}`;
    socket.join(rideRoom);
    console.log(`✅ Socket ${socket.id} joined ride room: ${rideRoom}`);
  });

  // Handle joining a delivery room (for customers and couriers tracking a delivery)
  socket.on('join-delivery', (deliveryId) => {
    const deliveryRoom = `delivery-${deliveryId}`;
    socket.join(deliveryRoom);
    console.log(`✅ Socket ${socket.id} joined delivery room: ${deliveryRoom}`);
  });

  // Handle delivery location updates
  socket.on('delivery-location-update', (data) => {
    if (data.deliveryId && data.location) {
      const deliveryRoom = `delivery-${data.deliveryId}`;
      io.to(deliveryRoom).emit('delivery-location-update', data);
      io.to('admin').emit('delivery-location-update', data);
    }
  });

  // Handle explicit request to check for pending rides
  // Handle courier checking for pending deliveries
  socket.on('check-pending-deliveries', async () => {
    try {
      const userId = socket.userId || socket.handshake.auth?.userId;
      if (!userId) {
        console.log('⚠️ check-pending-deliveries: No userId found');
        return;
      }

      const User = require('./models/User');
      const Delivery = require('./models/Delivery');
      const user = await User.findById(userId);

      if (!user || !user.isCourier || !user.courierInfo?.isAvailable || !user.courierInfo?.currentLocation) {
        console.log(`⚠️ Courier ${userId} not available or no location - skipping pending deliveries check`);
        return;
      }

      const radius = 10; // 10km radius
      const courierLat = user.courierInfo.currentLocation.latitude;
      const courierLng = user.courierInfo.currentLocation.longitude;

      // Find pending deliveries
      const pendingDeliveries = await Delivery.find({
        status: 'pending',
        courier: { $exists: false }
      }).populate('customer', 'name email phone').sort({ createdAt: -1 });

      console.log(`🔍 Courier ${userId} requested pending deliveries check - found ${pendingDeliveries.length} pending delivery/deliveries`);

      if (pendingDeliveries.length === 0) {
        return;
      }

      const courierRoom = `courier-${String(userId)}`;
      const roomMembers = io.sockets.adapter.rooms.get(courierRoom);
      const isCourierInRoom = roomMembers && roomMembers.size > 0;

      if (!isCourierInRoom) {
        console.log(`⚠️ Courier ${userId} not in socket room ${courierRoom} - cannot send pending deliveries`);
        return;
      }

      let deliveriesNotified = 0;
      let deliveriesTooFar = 0;

      pendingDeliveries.forEach(delivery => {
        if (!delivery.pickupLocation) {
          return;
        }

        const pickupLat = delivery.pickupLocation.latitude;
        const pickupLng = delivery.pickupLocation.longitude;

        // Haversine formula to calculate distance
        const R = 6371; // Earth's radius in km
        const dLat = (pickupLat - courierLat) * Math.PI / 180;
        const dLng = (pickupLng - courierLng) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(courierLat * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        if (distance <= radius) {
          console.log(`📦 Sending pending delivery ${delivery._id} to courier ${userId} (${distance.toFixed(2)}km away)`);
          io.to(courierRoom).emit('new-delivery-request', delivery.toObject());
          deliveriesNotified++;
        } else {
          deliveriesTooFar++;
        }
      });

      console.log(`✅ Notified courier ${userId} about ${deliveriesNotified} nearby delivery/deliveries`);
      if (deliveriesTooFar > 0) {
        console.log(`   ⚠️ ${deliveriesTooFar} delivery/deliveries too far away (>${radius}km)`);
      }
    } catch (error) {
      console.error('Error checking pending deliveries:', error);
    }
  });

  socket.on('check-pending-rides', async () => {
    try {
      // Find which driver room this socket is in
      const driverRooms = Array.from(io.sockets.adapter.rooms.keys()).filter(r => r.startsWith('driver-'));
      let driverRoom = null;
      let driverId = null;

      for (const room of driverRooms) {
        const members = io.sockets.adapter.rooms.get(room);
        if (members && members.has(socket.id)) {
          driverRoom = room;
          driverId = room.replace('driver-', '');
          break;
        }
      }

      if (!driverId) {
        console.log('⚠️ Socket requested pending rides but not in any driver room');
        return;
      }

      const User = require('./models/User');
      const Ride = require('./models/Ride');
      const user = await User.findById(driverId);

      if (user && user.driverInfo?.isAvailable && user.driverInfo?.currentLocation) {
        console.log(`🔍 Explicit check for pending rides requested by driver ${driverId}`);
        const radius = 10;
        const driverLat = user.driverInfo.currentLocation.latitude;
        const driverLng = user.driverInfo.currentLocation.longitude;

        const pendingRides = await Ride.find({
          status: 'pending',
          driver: { $exists: false }
        }).populate('rider', 'name email phone').sort({ createdAt: -1 });

        console.log(`   Found ${pendingRides.length} pending ride(s)`);

        if (pendingRides.length > 0) {
          let ridesNotified = 0;
          let ridesTooFar = 0;

          pendingRides.forEach(ride => {
            if (!ride.pickupLocation) return;

            const pickupLat = ride.pickupLocation.latitude;
            const pickupLng = ride.pickupLocation.longitude;

            const R = 6371;
            const dLat = (pickupLat - driverLat) * Math.PI / 180;
            const dLng = (pickupLng - driverLng) * Math.PI / 180;
            const a = 
              Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(driverLat * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;

            if (distance <= radius) {
              console.log(`📤 Sending pending ride ${ride._id} to driver ${driverId} (${distance.toFixed(2)}km away)`);
              io.to(driverRoom).emit('new-ride-request', ride.toObject());
              ridesNotified++;
            } else {
              ridesTooFar++;
            }
          });

          console.log(`✅ Sent ${ridesNotified} pending ride(s) to driver ${driverId} (${ridesTooFar} too far)`);
        }
      } else {
        console.log(`⚠️ Driver ${driverId} requested pending rides but is not available or has no location`);
      }
    } catch (error) {
      console.error('Error checking pending rides on request:', error);
    }
  });

  socket.on('location-update', (data) => {
    // Emit to ride room for riders and admins tracking the trip
    io.to(`ride-${data.rideId}`).emit('location-update', data);
    // Also emit to admin room for admin dashboard
    io.to('admin').emit('location-update', data);
  });

  socket.on('ride-status-update', (data) => {
    socket.to(`ride-${data.rideId}`).emit('ride-status-update', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Mzansi backend server running on port ${PORT}`);
});

