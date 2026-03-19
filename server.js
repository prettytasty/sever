const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const rooms = {};

function generateCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

app.get('/', (req, res) => res.send('RAT KEBAB SERVER RUNNING 🐀'));

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('host', (data) => {
    const code = generateCode();
    currentRoom = code;
    rooms[code] = { players: {} };
    rooms[code].players[socket.id] = { name: data.name || 'RAT', x: 0, y: 1, z: 5, yaw: 0 };
    socket.join(code);
    socket.emit('hosted', { code });
    io.to(code).emit('playerList', rooms[code].players);
    console.log(`Room ${code} created by ${socket.id}`);
  });

  socket.on('join', (data) => {
    const code = (data.code || '').toUpperCase().trim();
    if (!rooms[code]) { socket.emit('joinError', 'Room not found! Check the code.'); return; }
    currentRoom = code;
    rooms[code].players[socket.id] = { name: data.name || 'RAT', x: 0, y: 1, z: 5, yaw: 0 };
    socket.join(code);
    socket.emit('joined', { code });
    io.to(code).emit('playerList', rooms[code].players);
    console.log(`${socket.id} joined room ${code}`);
  });

  socket.on('move', (data) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    rooms[currentRoom].players[socket.id] = {
      ...rooms[currentRoom].players[socket.id],
      x: data.x, y: data.y, z: data.z, yaw: data.yaw, held: data.held || null
    };
    socket.to(currentRoom).emit('playerMoved', {
      id: socket.id,
      x: data.x, y: data.y, z: data.z, yaw: data.yaw,
      held: data.held || null, color: data.color || null,
      name: rooms[currentRoom].players[socket.id].name
    });
  });

  socket.on('grillUpdate', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('grillUpdate', data);
  });

  socket.on('rayHit', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('rayHit', { targetId: data.targetId });
  });

  socket.on('bulletHit', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('bulletHit', { targetId: data.targetId, damage: data.damage || 50 });
  });

  socket.on('customerKill', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('customerKill', { x: data.x, y: data.y, z: data.z });
  });

  // ── TV sync ───────────────────────────────────────────────────────
  socket.on('tvSync', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('tvSync', { state: data.state });
  });

  // ── Basket sync ───────────────────────────────────────────────────
  socket.on('basketSync', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('basketSync', { count: data.count });
  });

  // ── NPC sync ──────────────────────────────────────────────────────
  socket.on('npcSync', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('npcSync', data);
  });

  // ── Dropped item sync ─────────────────────────────────────────────
  socket.on('itemDrop', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('itemDrop', data);
  });

  socket.on('itemPickup', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('itemPickup', data);
  });

  // ── Chat ──────────────────────────────────────────────────────────
  socket.on('chat', (data) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const senderName = rooms[currentRoom].players[socket.id]?.name || 'RAT';
    const text = (data.text || '').toString().slice(0, 200);
    if (!text) return;
    socket.to(currentRoom).emit('chat', {
      name: senderName,
      text: `${senderName}: ${text}`
    });
  });

  // ── Disconnect ────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const name = rooms[currentRoom].players[socket.id]?.name || '?';
    delete rooms[currentRoom].players[socket.id];
    console.log(`${name} left room ${currentRoom}`);
    if (Object.keys(rooms[currentRoom].players).length === 0) {
      delete rooms[currentRoom];
    } else {
      io.to(currentRoom).emit('playerLeft', { id: socket.id });
      io.to(currentRoom).emit('playerList', rooms[currentRoom].players);
    }
  });

}); // ← connection block ends here

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🐀 Rat Kebab Server running on port ${PORT}`);
  setInterval(() => {
    const roomCount = Object.keys(rooms).length;
    const playerCount = Object.values(rooms).reduce((s, r) => s + Object.keys(r.players).length, 0);
    console.log(`[keepalive] rooms:${roomCount} players:${playerCount}`);
  }, 10 * 60 * 1000);
});
