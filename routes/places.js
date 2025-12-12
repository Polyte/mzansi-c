const express = require('express');
const axios = require('axios');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/places/search
// @desc    Search for places (businesses, POIs, addresses)
// @access  Private
router.get('/search', protect, async (req, res) => {
  try {
    const { query, latitude, longitude } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ message: 'Query must be at least 2 characters' });
    }

    // If Google Maps API key is available, use Google Places API
    if (process.env.GOOGLE_MAPS_API_KEY) {
      try {
        const radius = 5000; // 5km radius
        const location = latitude && longitude 
          ? `${latitude},${longitude}`
          : null;

        // Try Google Places Text Search first (better for business names)
        let placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        
        if (location) {
          placesUrl += `&location=${location}&radius=${radius}`;
        }

        const placesResponse = await axios.get(placesUrl);
        
        if (placesResponse.data.status === 'OK' && placesResponse.data.results.length > 0) {
          const places = placesResponse.data.results.slice(0, 5).map((place) => ({
            id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            location: {
              latitude: place.geometry.location.lat,
              longitude: place.geometry.location.lng
            },
            types: place.types,
            rating: place.rating,
            isBusiness: place.types?.some(type => 
              type.includes('store') || 
              type.includes('establishment') || 
              type.includes('point_of_interest')
            )
          }));

          return res.json({ places });
        }
      } catch (error) {
        console.error('Google Places API error:', error.message);
        // Fall through to fallback method
      }
    }

    // Fallback: Return empty results with message
    res.json({ 
      places: [],
      message: 'Places search requires Google Maps API key. Add GOOGLE_MAPS_API_KEY to .env file.'
    });
  } catch (error) {
    console.error('Places search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/places/autocomplete
// @desc    Get place autocomplete suggestions
// @access  Private
router.get('/autocomplete', protect, async (req, res) => {
  try {
    const { input, latitude, longitude } = req.query;

    if (!input || input.trim().length < 2) {
      return res.status(400).json({ message: 'Input must be at least 2 characters' });
    }

    // If Google Maps API key is available, use Google Places Autocomplete
    if (process.env.GOOGLE_MAPS_API_KEY) {
      try {
        const location = latitude && longitude 
          ? `${latitude},${longitude}`
          : null;

        let autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        
        if (location) {
          autocompleteUrl += `&location=${location}&radius=5000`;
        }

        const autocompleteResponse = await axios.get(autocompleteUrl);
        
        if (autocompleteResponse.data.status === 'OK' && autocompleteResponse.data.predictions.length > 0) {
          const predictions = autocompleteResponse.data.predictions.slice(0, 5).map((prediction) => ({
            id: prediction.place_id,
            description: prediction.description,
            mainText: prediction.structured_formatting?.main_text || prediction.description,
            secondaryText: prediction.structured_formatting?.secondary_text || '',
            types: prediction.types
          }));

          return res.json({ predictions });
        }
      } catch (error) {
        console.error('Google Places Autocomplete error:', error.message);
        // Fall through to fallback
      }
    }

    // Fallback: Return empty results
    res.json({ predictions: [] });
  } catch (error) {
    console.error('Places autocomplete error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/places/details
// @desc    Get place details by place_id
// @access  Private
router.get('/details', protect, async (req, res) => {
  try {
    const { placeId } = req.query;

    if (!placeId) {
      return res.status(400).json({ message: 'Place ID is required' });
    }

    if (process.env.GOOGLE_MAPS_API_KEY) {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,place_id&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        
        const detailsResponse = await axios.get(detailsUrl);
        
        if (detailsResponse.data.status === 'OK' && detailsResponse.data.result) {
          const place = detailsResponse.data.result;
          return res.json({
            name: place.name,
            address: place.formatted_address,
            location: {
              latitude: place.geometry.location.lat,
              longitude: place.geometry.location.lng
            }
          });
        }
      } catch (error) {
        console.error('Google Places Details error:', error.message);
      }
    }

    res.status(404).json({ message: 'Place not found' });
  } catch (error) {
    console.error('Place details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/places/directions
// @desc    Get route directions between two points using Google Directions API
// @access  Private
router.get('/directions', protect, async (req, res) => {
  try {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ message: 'Origin and destination are required' });
    }

    // Parse origin and destination (can be lat,lng or place_id)
    const originStr = typeof origin === 'string' ? origin : `${origin.latitude},${origin.longitude}`;
    const destStr = typeof destination === 'string' ? destination : `${destination.latitude},${destination.longitude}`;

    // If Google Maps API key is available, use Google Directions API
    if (process.env.GOOGLE_MAPS_API_KEY) {
      try {
        const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}&key=${process.env.GOOGLE_MAPS_API_KEY}&alternatives=false`;
        
        const directionsResponse = await axios.get(directionsUrl);
        
        if (directionsResponse.data.status === 'OK' && directionsResponse.data.routes.length > 0) {
          const route = directionsResponse.data.routes[0];
          const leg = route.legs[0];
          
          // Decode polyline to get coordinates
          const polyline = route.overview_polyline.points;
          const coordinates = decodePolyline(polyline);
          
          return res.json({
            coordinates,
            distance: leg.distance.value, // in meters
            duration: leg.duration.value, // in seconds
            distanceText: leg.distance.text,
            durationText: leg.duration.text,
            startAddress: leg.start_address,
            endAddress: leg.end_address
          });
        } else {
          // Provide more helpful error messages
          let errorMessage = `Directions API error: ${directionsResponse.data.status}`;
          
          if (directionsResponse.data.status === 'REQUEST_DENIED') {
            errorMessage = 'Directions API access denied. Check: 1) API key is valid, 2) Directions API is enabled, 3) Billing is enabled on Google Cloud project, 4) API key restrictions allow this request.';
          } else if (directionsResponse.data.status === 'INVALID_REQUEST') {
            errorMessage = 'Invalid request to Directions API. Check origin and destination parameters.';
          } else if (directionsResponse.data.status === 'OVER_QUERY_LIMIT') {
            errorMessage = 'Directions API quota exceeded. Check your Google Cloud billing and quotas.';
          } else if (directionsResponse.data.status === 'ZERO_RESULTS') {
            errorMessage = 'No route found between origin and destination.';
          }
          
          // Log error but don't spam console for expected billing errors
          if (directionsResponse.data.status !== 'REQUEST_DENIED') {
            console.error('Google Directions API error:', directionsResponse.data.status, directionsResponse.data.error_message || '');
          } else {
            console.log('⚠️ Google Directions API: Billing not enabled (expected in development)');
          }
          
          return res.status(400).json({ 
            message: errorMessage,
            status: directionsResponse.data.status,
            errorMessage: directionsResponse.data.error_message
          });
        }
      } catch (error) {
        console.error('Google Directions API error:', error.message);
        return res.status(500).json({ message: 'Failed to get directions from Google Maps' });
      }
    }

    // Fallback: Return error if no API key
    res.status(400).json({ 
      message: 'Directions require Google Maps API key. Add GOOGLE_MAPS_API_KEY to .env file.' 
    });
  } catch (error) {
    console.error('Directions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to decode Google Maps polyline
function decodePolyline(encoded) {
  const poly = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({
      latitude: lat * 1e-5,
      longitude: lng * 1e-5
    });
  }
  return poly;
}

module.exports = router;

