// Simple standalone Socket.IO broker for production (Railway/Render/etc.)
// Usage: NODE_ENV=production PORT=4000 node server/socket-broker.js
// Client should set NEXT_PUBLIC_SOCKET_BASE to the broker origin (e.g., https://your-broker.example)

const http = require('http');
const { Server } = require('socket.io');

const port = process.env.PORT || 4000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('socket-broker ok');
});

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  socket.on('join', ({ roomId }) => socket.join(roomId));
  socket.on('leave', ({ roomId }) => socket.leave(roomId));
  socket.on('typing', ({ roomId, userId }) => socket.to(roomId).emit('typing', { userId }));
  // This broker just relays messages already saved via REST; no DB here
  socket.on('message', (payload) => {
    const { roomId } = payload || {};
    if (!roomId) return;
    io.to(roomId).emit('message', payload);
  });
});

server.listen(port, () => {
  console.log(`Socket broker listening on :${port}`);
});


