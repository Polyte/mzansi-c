const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/voice/token
// @desc    Generate Agora RTC token for voice calling
// @access  Private
router.post('/token', protect, async (req, res) => {
  try {
    const { channelName, uid } = req.body;

    if (!channelName) {
      return res.status(400).json({ message: 'Channel name is required' });
    }

    // Get Agora credentials from environment variables
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      console.error('❌ Agora credentials not configured');
      console.error('   Please add AGORA_APP_ID and AGORA_APP_CERTIFICATE to backend/.env');
      console.error('   See AGORA_CREDENTIALS_SETUP.md for instructions');
      return res.status(500).json({ 
        message: 'Voice service not configured. Please add Agora credentials to backend/.env file. See AGORA_CREDENTIALS_SETUP.md for setup instructions.' 
      });
    }

    // Generate UID if not provided (use user ID as default)
    const userId = uid || req.user.id.toString();
    const channelUid = parseInt(userId.replace(/\D/g, '').slice(-10)) || 0;

    // Token expires in 24 hours
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + (24 * 3600);

    // Build token with publisher role (can both publish and subscribe)
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      channelUid,
      RtcRole.PUBLISHER,
      expirationTimeInSeconds
    );

    res.json({
      token,
      appId,
      channelName,
      uid: channelUid
    });
  } catch (error) {
    console.error('Generate Agora token error:', error);
    res.status(500).json({ message: 'Failed to generate voice token' });
  }
});

module.exports = router;

