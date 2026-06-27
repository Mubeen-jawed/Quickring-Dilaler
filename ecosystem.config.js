// PM2 process definition for QuickRing (production).
// The Express server (server/index.js) loads ../.env via dotenv and, when
// NODE_ENV=production, serves the built React app from client/dist plus the
// API and Socket.IO on a single port.
module.exports = {
  apps: [
    {
      name: 'quickring',
      cwd: './server',
      script: 'index.js',
      instances: 1,           // single instance: Socket.IO + in-memory state need sticky sessions
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
  ],
};
