# Google Maps API Troubleshooting

## Common Errors and Solutions

### REQUEST_DENIED Error

If you're getting `REQUEST_DENIED` errors, check the following:

#### 1. **Enable Required APIs**
Make sure these APIs are enabled in your Google Cloud Console:
- ✅ **Directions API** (Required for route visualization)
- ✅ **Places API** (Required for business search)
- ✅ **Places API (New)** (Required for autocomplete)
- ✅ **Geocoding API** (Required for address conversion)

**How to enable:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to "APIs & Services" > "Library"
4. Search for each API and click "Enable"

#### 2. **Enable Billing**
Google Maps APIs require billing to be enabled (even for free tier):
1. Go to "Billing" in Google Cloud Console
2. Link a billing account to your project
3. Don't worry - you get $200 free credit per month!

#### 3. **Check API Key Restrictions**
If your API key has restrictions, make sure:
- **Application restrictions**: Allow requests from your server IP or remove restrictions for testing
- **API restrictions**: Include "Directions API", "Places API", "Geocoding API"

**To check/update:**
1. Go to "APIs & Services" > "Credentials"
2. Click on your API key
3. Check "Application restrictions" and "API restrictions"

#### 4. **Verify API Key in .env**
Make sure your `.env` file has the correct API key:
```env
GOOGLE_MAPS_API_KEY=AIzaSyYourActualKeyHere
```

**Important:** 
- Remove any quotes around the key
- No spaces before/after the `=`
- Restart your backend server after changing `.env`

#### 5. **Test Your API Key**
You can test if your API key works by running this in your terminal:
```bash
curl "https://maps.googleapis.com/maps/api/directions/json?origin=Sydney&destination=Melbourne&key=YOUR_API_KEY"
```

If it works, you'll see JSON with route data. If not, you'll see an error message.

## Other Common Errors

### OVER_QUERY_LIMIT
- You've exceeded your quota
- Check your Google Cloud Console for quota limits
- Free tier: $200 credit/month

### INVALID_REQUEST
- Check that origin and destination coordinates are valid
- Make sure latitude/longitude are numbers, not strings

### ZERO_RESULTS
- No route found between the two points
- This can happen if locations are too far apart or unreachable

## Quick Fix Checklist

- [ ] APIs enabled in Google Cloud Console
- [ ] Billing account linked to project
- [ ] API key has correct permissions
- [ ] API key in `.env` file (no quotes, no spaces)
- [ ] Backend server restarted after `.env` changes
- [ ] API key restrictions allow your server IP (if restrictions are set)

## Still Having Issues?

1. **Check Google Cloud Console Logs:**
   - Go to "APIs & Services" > "Dashboard"
   - Check for error messages

2. **Verify API Key:**
   - Go to "APIs & Services" > "Credentials"
   - Make sure the key is active and not restricted incorrectly

3. **Test with curl:**
   ```bash
   curl "https://maps.googleapis.com/maps/api/directions/json?origin=New+York&destination=Los+Angeles&key=YOUR_KEY"
   ```

4. **Check Backend Logs:**
   - Look for detailed error messages in your backend console
   - The error message should tell you what's wrong

## Need Help?

- [Google Maps API Documentation](https://developers.google.com/maps/documentation)
- [Google Cloud Support](https://cloud.google.com/support)
- Check `GOOGLE_PLACES_SETUP.md` for initial setup instructions

