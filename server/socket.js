const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// In-memory agent presence map: agentId -> { id, name, email, status, socketId }
const agentPresence = new Map();

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.agent = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const agent = socket.agent;
    console.log(`Socket connected: agent ${agent.id} (${agent.name})`);

    // Join agent-specific room
    socket.join(`agent:${agent.id}`);

    // Set presence to available
    agentPresence.set(agent.id, {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      status: 'available',
      socketId: socket.id,
    });

    // Broadcast updated agents list
    io.emit('agents:list', Array.from(agentPresence.values()));

    // Handle agent status change
    socket.on('agent:setStatus', (status) => {
      const entry = agentPresence.get(agent.id);
      if (entry) {
        entry.status = status;
        io.emit('agents:list', Array.from(agentPresence.values()));
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: agent ${agent.id} (${reason})`);
      agentPresence.delete(agent.id);
      io.emit('agents:list', Array.from(agentPresence.values()));
    });
  });

  return io;
}

module.exports = { initSocket };
