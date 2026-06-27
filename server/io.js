// Singleton holder for the Socket.IO server instance.
// Allows route files to emit events without circular dependencies.

let io = null;

function setIO(instance) {
  io = instance;
}

function getIO() {
  return io;
}

module.exports = { setIO, getIO };
