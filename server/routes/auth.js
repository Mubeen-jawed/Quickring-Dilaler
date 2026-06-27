const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { TOTP, Secret } = require('otpauth');
const db = require('../db');

const router = express.Router();

// Step 1: Verify username + password, return a short-lived TOTP challenge token
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await db.query(
      'SELECT id, name, email, password_hash, phone_number, totp_secret FROM kc_agents WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const agent = result.rows[0];
    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Agent has TOTP enabled — require verification
    if (agent.totp_secret) {
      const totpToken = jwt.sign(
        { id: agent.id, purpose: 'totp-challenge' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({ requireTotp: true, totpToken });
    }

    // No TOTP — issue tokens directly (shouldn't happen with current setup)
    const accessToken = jwt.sign(
      { id: agent.id, name: agent.name, email: agent.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    const refreshToken = jwt.sign(
      { id: agent.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      agent: { id: agent.id, name: agent.name, email: agent.email, phone_number: agent.phone_number },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Step 2: Verify the 6-digit TOTP code from the authenticator app
router.post('/verify-totp', async (req, res) => {
  try {
    const { totpToken, code } = req.body;
    if (!totpToken || !code) {
      return res.status(400).json({ error: 'TOTP token and code required' });
    }

    let payload;
    try {
      payload = jwt.verify(totpToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'TOTP challenge expired, please login again' });
    }

    if (payload.purpose !== 'totp-challenge') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const result = await db.query(
      'SELECT id, name, email, phone_number, totp_secret FROM kc_agents WHERE id = $1 AND is_active = true',
      [payload.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Agent not found' });
    }

    const agent = result.rows[0];

    const totp = new TOTP({
      issuer: 'QuickRing',
      label: agent.email,
      secret: Secret.fromBase32(agent.totp_secret),
      period: 30,
      digits: 6,
    });

    // Validate with a window of 1 (accepts current, previous, and next 30s window)
    const delta = totp.validate({ token: code.trim(), window: 1 });
    if (delta === null) {
      return res.status(401).json({ error: 'Invalid code. Check your authenticator app and try again.' });
    }

    const accessToken = jwt.sign(
      { id: agent.id, name: agent.name, email: agent.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    const refreshToken = jwt.sign(
      { id: agent.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      agent: { id: agent.id, name: agent.name, email: agent.email, phone_number: agent.phone_number },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('TOTP verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const result = await db.query(
      'SELECT id, name, email FROM kc_agents WHERE id = $1 AND is_active = true',
      [payload.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Agent not found' });
    }

    const agent = result.rows[0];
    const accessToken = jwt.sign(
      { id: agent.id, name: agent.name, email: agent.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

module.exports = router;
