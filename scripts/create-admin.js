/**
 * Script to create an admin user
 * Usage: node scripts/create-admin.js <email> <password> <name> <phone>
 * Example: node scripts/create-admin.js admin@mzansi.com admin123 "Admin User" "+27123456789"
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mzansi', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`📦 MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    return false;
  }
};

const createAdmin = async () => {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.log('❌ Usage: node scripts/create-admin.js <email> <password> <name> <phone>');
    console.log('Example: node scripts/create-admin.js admin@mzansi.com admin123 "Admin User" "+27123456789"');
    process.exit(1);
  }

  const [email, password, name, phone] = args;

  const connected = await connectDB();
  if (!connected) {
    console.error('❌ Failed to connect to MongoDB');
    process.exit(1);
  }

  try {
    // Check if admin already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Update existing user to admin
      existingUser.role = 'admin';
      // Set password directly and mark as modified to trigger pre-save hook
      existingUser.password = password;
      existingUser.markModified('password');
      await existingUser.save();
      console.log('✅ Updated existing user to admin:', email);
      console.log('   Password has been updated');
    } else {
      // Create new admin user
      const admin = await User.create({
        name,
        email,
        password,
        phone,
        role: 'admin',
        isDriver: false
      });
      console.log('✅ Admin user created successfully!');
      console.log('   Email:', admin.email);
      console.log('   Name:', admin.name);
      console.log('   Role:', admin.role);
    }

    console.log('\n📝 You can now login to the admin panel with:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('\n🌐 Admin Panel URL: http://localhost:3000');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
};

createAdmin();

