const mongoose = require('mongoose');

const connectDB = async () => {
  // Support both MONGODB_URI and connection_string for compatibility
  const mongoURI = process.env.MONGODB_URI || process.env.connection_string || 'mongodb://localhost:27017/mzansi';
  
  try {
    const conn = await mongoose.connect(mongoURI, {
      // Note: useNewUrlParser and useUnifiedTopology are deprecated in Mongoose 6+
      // They're kept for backward compatibility but have no effect
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      // MongoDB Atlas requires SSL/TLS - these options help with SSL errors
      ssl: mongoURI.includes('mongodb+srv://') || mongoURI.includes('mongodb.net'),
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
    });

    console.log(`📦 MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('\n💡 To fix this:');
    console.error('   1. Start MongoDB: mongod');
    console.error('   2. Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas');
    console.error('   3. Update MONGODB_URI in .env file\n');
    
    // In development, don't crash - allow server to start
    // Routes will fail gracefully if DB is not connected
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    return false;
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

module.exports = connectDB;

