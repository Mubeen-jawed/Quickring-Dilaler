require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');

const db = require('./db');
const authRoutes = require('./routes/auth');
const tokenRoutes = require('./routes/token');
const twimlRoutes = require('./routes/twiml');
const callsRoutes = require('./routes/calls');
const { initSocket } = require('./socket');
const { setIO } = require('./io');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3008;

// Initialize Socket.IO
const io = initSocket(server);
setIO(io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/twiml', twimlRoutes);
app.use('/api/calls', callsRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Serve built frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

server.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Auto-migrate: ensure recording columns exist
  try {
    await db.query('ALTER TABLE kc_call_logs ADD COLUMN IF NOT EXISTS recording_sid VARCHAR(64)');
    await db.query('ALTER TABLE kc_call_logs ADD COLUMN IF NOT EXISTS recording_url TEXT');
  } catch (err) {
    console.error('Auto-migration warning:', err.message);
  }
});
