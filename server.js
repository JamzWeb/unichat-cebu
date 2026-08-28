const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static frontend files from the 'public' folder
app.use(express.static('public'));

let waitingQueue = [];
const activeRooms = new Map();

const emojiRegex = /[\p{Extended_Pictographic}\p{Emoji_Component}]/u;
const ADMIN_SECRET_PASSWORD = "jamzrieven1";

io.on('connection', (socket) => {
  console.log(`⚡ User connected: ${socket.id}`);

  socket.on('register_user', (userData) => {
    if (emojiRegex.test(userData.nickname)) {
      socket.emit('registration_error', 'Nicknames cannot contain emojis.');
      return;
    }

    // Verify Admin Password if admin login was requested
    if (userData.isAdmin) {
      if (userData.adminPassword !== ADMIN_SECRET_PASSWORD) {
        socket.emit('registration_error', 'Incorrect Admin Secret Password!');
        return;
      }
      socket.isAdmin = true;
    } else {
      socket.isAdmin = false;
    }

    socket.nickname = userData.nickname;
    socket.school = userData.school;

    // Confirm login success back to client
    socket.emit('login_success', { isAdmin: socket.isAdmin });

    waitingQueue.push(socket);
    tryPairUsers();
  });

  socket.on('send_message', (data) => {
    const roomId = activeRooms.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('receive_message', {
        sender: socket.nickname,
        school: socket.school,
        text: data.text,
        isAdmin: socket.isAdmin
      });
    }
  });

  socket.on('skip_partner', () => {
    cleanupPair(socket);
    waitingQueue.push(socket);
    tryPairUsers();
  });

  socket.on('report_user', (data) => {
    const roomId = activeRooms.get(socket.id);
    // Broadcast report notification to all connected admin sockets if needed
    console.log(`🚨 Report logged: ${data.reason} from room ${roomId}`);
  });

  socket.on('disconnect', () => {
    cleanupPair(socket);
    waitingQueue = waitingQueue.filter(s => s.id !== socket.id);
    console.log(`🔌 User disconnected: ${socket.id}`);
  });
});

function tryPairUsers() {
  while (waitingQueue.length >= 2) {
    const user1 = waitingQueue.shift();
    const user2 = waitingQueue.shift();

    // Ensure sockets are still connected before pairing
    if (!user1.connected || !user2.connected) continue;

    const roomId = `room_${user1.id}_${user2.id}`;
    user1.join(roomId);
    user2.join(roomId);

    activeRooms.set(user1.id, roomId);
    activeRooms.set(user2.id, roomId);

    user1.emit('partner_matched', { nickname: user2.nickname, school: user2.school, isAdmin: user2.isAdmin });
    user2.emit('partner_matched', { nickname: user1.nickname, school: user1.school, isAdmin: user1.isAdmin });
  }
}

function cleanupPair(socket) {
  const roomId = activeRooms.get(socket.id);
  if (roomId) {
    socket.to(roomId).emit('receive_message', {
      sender: 'System',
      school: '',
      text: 'Your chat partner has left the session.',
      isAdmin: false
    });
    activeRooms.delete(socket.id);
  }
}

// Dynamic port assignment for Render compatibility
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 UNICHAT server running on port ${PORT}`);
});
