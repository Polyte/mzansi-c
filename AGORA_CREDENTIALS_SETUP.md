# Agora Credentials Setup

## The Error
You're seeing: **"Voice service not configured. Please contact support."**

This means the backend doesn't have Agora credentials configured.

## Quick Fix

### Step 1: Get Agora Credentials

1. **Sign up for Agora** (if you haven't):
   - Go to https://www.agora.io/
   - Click "Sign Up" (free account)
   - Verify your email

2. **Create a Project**:
   - Log in to https://console.agora.io/
   - Click "Create" → "Project"
   - Choose "Audio Only" or "Audio & Video"
   - Give it a name (e.g., "Mzansi Voice")
   - Click "Submit"

3. **Get Your Credentials**:
   - In your project, go to "Project Management"
   - Find your project and click "Edit"
   - You'll see:
     - **App ID**: A long string (e.g., `12345678901234567890123456789012`)
     - **App Certificate**: Click "Show" to reveal it (e.g., `abcdef1234567890abcdef1234567890`)

### Step 2: Add to Backend .env

Open or create `backend/.env` and add:

```env
AGORA_APP_ID=your_app_id_here
AGORA_APP_CERTIFICATE=your_app_certificate_here
```

**Example:**
```env
AGORA_APP_ID=12345678901234567890123456789012
AGORA_APP_CERTIFICATE=abcdef1234567890abcdef1234567890
```

### Step 3: Restart Backend Server

```bash
cd backend
# Stop the current server (Ctrl+C)
# Then restart:
npm start
# or
npm run dev
```

### Step 4: Test

1. Start a trip (as rider or driver)
2. Tap "Call Driver" or "Call Rider"
3. The call should now work!

## Free Tier

Agora offers **10,000 free minutes per month** - perfect for development and testing!

## Troubleshooting

### Still getting the error?
- Make sure `.env` is in the `backend/` directory (not `backend/.env.example`)
- Make sure there are no spaces around the `=` sign
- Make sure the values don't have quotes (unless they're part of the actual value)
- Restart the backend server after adding credentials

### Can't find App Certificate?
- Some projects might not have a certificate initially
- You may need to enable "App Certificate" in project settings
- Or use a temporary token (not recommended for production)

## Next Steps

Once credentials are added:
1. ✅ Backend will generate tokens successfully
2. ✅ Mobile app can make calls
3. ✅ Both users can communicate via voice

---

**Need help?** Check the main `AGORA_SETUP.md` file for more details.

