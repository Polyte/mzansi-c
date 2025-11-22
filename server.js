const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const rideRoutes = require('./routes/rides');
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
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mzansi API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
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

  // Handle driver joining their driver room
  // IMPORTANT: Only drivers should join driver rooms - ride requests are ONLY sent here
  socket.on('join', (room) => {
    if (typeof room === 'string') {
      if (room.startsWith('driver-')) {
        socket.join(room);
        const driverId = room.replace('driver-', '');
        console.log(`✅ Driver joined room: ${room} (socket: ${socket.id}, driverId: ${driverId}) - Ride requests will be sent here ONLY`);
        
        // Verify room membership
        const roomMembers = io.sockets.adapter.rooms.get(room);
        if (roomMembers) {
          console.log(`📊 Room ${room} now has ${roomMembers.size} member(s)`);
          console.log(`   Socket IDs in room:`, Array.from(roomMembers));
        } else {
          console.warn(`⚠️ Room ${room} was created but has no members - this shouldn't happen`);
        }
        
        // Log all current driver rooms for debugging
        const allRooms = Array.from(io.sockets.adapter.rooms.keys()).filter(r => r.startsWith('driver-'));
        console.log(`📋 Total driver rooms active: ${allRooms.length}`);
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

