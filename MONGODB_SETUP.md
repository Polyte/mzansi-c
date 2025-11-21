# MongoDB Setup Guide

## Option 1: Local MongoDB (Recommended for Development)

### Install MongoDB

**macOS (using Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Linux (Ubuntu/Debian):**
```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Create list file
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

**Windows:**
Download and install from: https://www.mongodb.com/try/download/community

### Start MongoDB

```bash
# macOS/Linux
mongod

# Or as a service
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

### Verify MongoDB is Running

```bash
mongosh
# Should connect to MongoDB shell
```

### Create .env File

Create `backend/.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/impala
JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRE=7d
```

## Option 2: MongoDB Atlas (Cloud - Recommended for Production)

### Steps:

1. **Sign up** at https://www.mongodb.com/cloud/atlas/register

2. **Create a free cluster:**
   - Choose a cloud provider (AWS, Google Cloud, Azure)
   - Select a region close to you
   - Choose the FREE tier (M0)

3. **Create a database user:**
   - Go to "Database Access"
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Create username and password (save these!)

4. **Whitelist your IP:**
   - Go to "Network Access"
   - Click "Add IP Address"
   - For development: Click "Allow Access from Anywhere" (0.0.0.0/0)
   - For production: Add only your server IPs

5. **Get connection string:**
   - Go to "Clusters"
   - Click "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `impala` (or your preferred database name)

6. **Update .env:**
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/impala?retryWrites=true&w=majority
   ```

## Quick Start (Local MongoDB)

```bash
# 1. Start MongoDB
mongod

# 2. In another terminal, start the backend
cd backend
npm run dev

# 3. Verify connection
# You should see: "📦 MongoDB Connected: 127.0.0.1"
```

## Troubleshooting

### MongoDB won't start

**macOS:**
```bash
# Check if MongoDB is already running
brew services list

# Stop and restart
brew services stop mongodb-community
brew services start mongodb-community

# Check logs
tail -f /usr/local/var/log/mongodb/mongo.log
```

**Linux:**
```bash
# Check status
sudo systemctl status mongod

# View logs
sudo journalctl -u mongod
```

### Connection Refused Error

1. **Check if MongoDB is running:**
   ```bash
   # macOS/Linux
   ps aux | grep mongod
   
   # Or try to connect
   mongosh
   ```

2. **Check if port 27017 is in use:**
   ```bash
   # macOS/Linux
   lsof -i :27017
   
   # Windows
   netstat -ano | findstr :27017
   ```

3. **Start MongoDB:**
   ```bash
   mongod
   ```

### Permission Errors

**macOS:**
```bash
# Create data directory
sudo mkdir -p /usr/local/var/mongodb
sudo chown $(whoami) /usr/local/var/mongodb

# Create log directory
sudo mkdir -p /usr/local/var/log/mongodb
sudo chown $(whoami) /usr/local/var/log/mongodb
```

**Linux:**
```bash
# Fix permissions
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown -R mongodb:mongodb /var/log/mongodb
```

## Testing the Connection

```bash
# Test MongoDB connection
mongosh

# Or test with Node.js
cd backend
node -e "require('./config/db')().then(() => process.exit(0)).catch(() => process.exit(1))"
```

## Production Recommendations

1. **Use MongoDB Atlas** for production
2. **Set strong JWT_SECRET** in environment variables
3. **Enable authentication** in MongoDB
4. **Use connection pooling** (already configured)
5. **Monitor connection health** (health check endpoint available)

