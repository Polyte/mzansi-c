#!/bin/bash

# Setup script for Mzansi backend

echo "🚀 Mzansi Backend Setup"
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "✅ .env file already exists"
else
    echo "📝 Creating .env file..."
    cat > .env << EOF
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/mzansi
JWT_SECRET=mzansi_jwt_secret_key_change_in_production
JWT_EXPIRE=7d
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
STRIPE_SECRET_KEY=your_stripe_secret_key_here
EOF
    echo "✅ .env file created"
    echo ""
    echo "⚠️  Please update MONGODB_URI if using MongoDB Atlas"
fi

# Check if MongoDB is installed
if command -v mongod &> /dev/null; then
    echo "✅ MongoDB is installed"
    
    # Check if MongoDB is running
    if pgrep -x "mongod" > /dev/null; then
        echo "✅ MongoDB is running"
    else
        echo "⚠️  MongoDB is not running"
        echo "   Start it with: mongod"
        echo "   Or on macOS: brew services start mongodb-community"
    fi
else
    echo "❌ MongoDB is not installed"
    echo ""
    echo "To install MongoDB:"
    echo "  macOS: brew tap mongodb/brew && brew install mongodb-community"
    echo "  Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas"
    echo ""
    echo "See QUICK_MONGODB.md for detailed instructions"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Make sure MongoDB is running (or use MongoDB Atlas)"
echo "  2. Update .env with your MongoDB connection string if needed"
echo "  3. Run: npm run dev"

