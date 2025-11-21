# Google Places API Setup

To enable business/POI search (like finding "Makro"), you need to set up Google Places API.

## Steps

1. **Get Google Maps API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable these APIs:
     - Places API
     - Places API (New)
     - Geocoding API
     - Directions API (for route visualization)
   - Create credentials (API Key)
   - Restrict the API key (recommended for production)

2. **Add to Backend .env:**
   ```env
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   ```

3. **Restart Backend:**
   ```bash
   cd backend
   npm run dev
   ```

## What This Enables

- ✅ Search for businesses by name (e.g., "Makro", "Woolworths")
- ✅ Find points of interest
- ✅ Better address autocomplete
- ✅ More accurate location results
- ✅ Real route visualization following actual roads (like Google Maps)

## Without Google Places API

The app will still work but will only use basic geocoding which:
- Works for street addresses
- May not find businesses by name
- Limited to expo-location capabilities
- Route visualization will be a simple curved line (not following actual roads)

## Cost

Google Places API has a free tier:
- $200 free credit per month
- Autocomplete: $2.83 per 1000 requests
- Text Search: $32 per 1000 requests
- Details: $17 per 1000 requests
- Directions: $5 per 1000 requests

For development/testing, the free tier should be sufficient.

## Testing

After setup, try searching for:
- "Makro"
- "Woolworths"
- "Pick n Pay"
- Any business name

You should see business results in the autocomplete suggestions!

