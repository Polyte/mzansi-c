# Quick MongoDB Setup

## MongoDB is not installed on your system

You have two options:

## Option 1: Install MongoDB Locally (5 minutes)

### macOS:
```bash
# Install using Homebrew
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community
```

### Then create .env file:
```bash
cd backend
cp .env.example .env
# Edit .env if needed (defaults should work)
```

### Start the backend:
```bash
npm run dev
```

## Option 2: Use MongoDB Atlas (Cloud - 3 minutes, No Installation)

1. **Go to:** https://www.mongodb.com/cloud/atlas/register
2. **Create free account** (no credit card needed)
3. **Create a free cluster** (M0 - Free tier)
4. **Create database user:**
   - Database Access → Add New Database User
   - Username: `impala` (or any username)
   - Password: Create a strong password (save it!)
5. **Whitelist IP:**
   - Network Access → Add IP Address
   - Click "Allow Access from Anywhere" (0.0.0.0/0) for development
6. **Get connection string:**
   - Clusters → Connect → Connect your application
   - Copy the connection string
   - Replace `<password>` with your password
   - Replace `<dbname>` with `impala`

7. **Create .env file:**
```bash
cd backend
cp .env.example .env
```

8. **Edit .env and add your MongoDB Atlas connection string:**
```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/impala?retryWrites=true&w=majority
```

9. **Start the backend:**
```bash
npm run dev
```

## Verify It's Working

After starting the backend, you should see:
```
📦 MongoDB Connected: [your connection host]
🚀 Impala backend server running on port 5000
```

If you see connection errors, check:
- MongoDB is running (if using local)
- Connection string is correct (if using Atlas)
- IP is whitelisted (if using Atlas)

