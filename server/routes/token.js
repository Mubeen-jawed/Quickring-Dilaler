const express = require('express');
const twilio = require('twilio');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.get('/twilio-token', authenticate, (req, res) => {
  try {
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: true,
    });

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity: `agent_${req.agent.id}`, ttl: 3600 }
    );

    token.addGrant(voiceGrant);

    res.json({ token: token.toJwt() });
  } catch (err) {
    console.error('Token generation error:', err);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

module.exports = router;
