const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

let waitingUser = null;
let activeRooms = new Map();
let onlineUsersCount = 0;

let reportsList = [];
let feedbackList = [];

// DYNAMIC STAFF ACCOUNTS (Master Admin & 5 Managed Moderator Slots)
let staffAccounts = {
    admin: { username: "Jamz", password: "119105" },
    mods: [
        { id: 1, username: "moderator1", password: "11111", status: "Active" },
        { id: 2, username: "moderator2", password: "22222", status: "Active" },
        { id: 3, username: "moderator3", password: "33333", status: "Active" },
        { id: 4, username: "moderator4", password: "44444", status: "Inactive / Open Slot" },
        { id: 5, username: "moderator5", password: "55555", status: "Inactive / Open Slot" }
    ]
};

io.on('connection', (socket) => {
    onlineUsersCount++;
    io.emit('online-count-update', onlineUsersCount);

    socket.on('find-stranger', (userData) => {
        socket.userData = userData;

        if (waitingUser && waitingUser.id !== socket.id) {
            const roomName = `room_${socket.id}_${waitingUser.id}`;
            
            socket.join(roomName);
            waitingUser.join(roomName);

            activeRooms.set(socket.id, roomName);
            activeRooms.set(waitingUser.id, roomName);

            const stranger1 = { id: socket.id, nickname: socket.userData.nickname, school: socket.userData.school };
            const stranger2 = { id: waitingUser.id, nickname: waitingUser.userData.nickname, school: waitingUser.userData.school };

            io.to(roomName).emit('matched', { room: roomName, partner1: stranger1, partner2: stranger2 });
            
            waitingUser = null;
        } else {
            waitingUser = socket;
            socket.emit('waiting');
        }
    });

    socket.on('chat-message', (data) => {
        socket.to(data.room).emit('chat-message', data);
    });

    // Handle official chat reactions
    socket.on('message-reaction', (data) => {
        socket.to(data.room).emit('message-reaction', data);
    });

    socket.on('typing', (data) => {
        socket.to(data.room).emit('typing', data);
    });

    socket.on('submit-feedback', (data) => {
        const entry = {
            type: data.type,
            message: data.message,
            senderSchool: data.school || 'Anonymous',
            timestamp: new Date().toLocaleString()
        };

        if (data.type === 'report') {
            reportsList.unshift(entry);
        } else {
            feedbackList.unshift(entry);
        }
    });

    // Master Admin updating staff credentials dynamically
    socket.on('admin:updateStaff', ({ adminPass, targetType, targetId, newUsername, newPassword }) => {
        if (adminPass !== staffAccounts.admin.password) {
            return socket.emit('admin:actionError', 'Unauthorized: Incorrect Master Admin password.');
        }

        if (targetType === 'admin') {
            if (newUsername) staffAccounts.admin.username = newUsername;
            if (newPassword) staffAccounts.admin.password = newPassword;
            socket.emit('admin:actionSuccess', 'Master Admin credentials updated successfully!');
        } else if (targetType === 'mod') {
            const mod = staffAccounts.mods.find(m => m.id === parseInt(targetId));
            if (mod) {
                if (newUsername) mod.username = newUsername;
                if (newPassword) mod.password = newPassword;
                mod.status = 'Active';
                socket.emit('admin:actionSuccess', `Moderator Slot #${targetId} updated successfully!`);
            } else {
                socket.emit('admin:actionError', 'Moderator slot not found.');
            }
        }
    });

    socket.on('skip', () => {
        handleDisconnectOrSkip(socket);
    });

    socket.on('disconnect', () => {
        onlineUsersCount = Math.max(0, onlineUsersCount - 1);
        io.emit('online-count-update', onlineUsersCount);
        handleDisconnectOrSkip(socket);
    });
});

// Admin & Moderator Login API
app.get('/api/admin/data', (req, res) => {
    const password = req.query.pass;

    if (password === staffAccounts.admin.password) {
        return res.json({
            role: 'admin',
            adminUsername: staffAccounts.admin.username,
            onlineUsers: onlineUsersCount,
            activeRoomsCount: activeRooms.size / 2,
            reports: reportsList,
            feedback: feedbackList,
            moderators: staffAccounts.mods
        });
    }

    const matchedMod = staffAccounts.mods.find(m => m.password === password && m.status === 'Active');
    if (matchedMod) {
        return res.json({
            role: 'moderator',
            modName: matchedMod.username,
            onlineUsers: onlineUsersCount,
            activeRoomsCount: activeRooms.size / 2,
            reports: reportsList,
            feedback: feedbackList
        });
    }

    return res.status(403).json({ error: 'Unauthorized access. Invalid password or revoked slot.' });
});

function handleDisconnectOrSkip(socket) {
    if (waitingUser === socket) {
        waitingUser = null;
    }

    const roomName = activeRooms.get(socket.id);
    if (roomName) {
        socket.to(roomName).emit('partner-disconnected');
        
        const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
        if (socketsInRoom) {
            for (const sId of socketsInRoom) {
                const s = io.sockets.sockets.get(sId);
                if (s) s.leave(roomName);
                activeRooms.delete(sId);
            }
        }
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
