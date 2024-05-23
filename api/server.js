const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
    }
});

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('createRoom', (roomName) => {
        if (rooms[roomName]) {
            socket.emit('roomExists', roomName);
        } else {
            rooms[roomName] = [socket.id];
            socket.join(roomName);
            socket.emit('roomCreated', roomName);
            console.log(`Room ${roomName} created by ${socket.id}`);
        }
    });

    socket.on('joinRoom', (roomName) => {
        if (rooms[roomName] && rooms[roomName].length < 2) {
            rooms[roomName].push(socket.id);
            socket.join(roomName);
            socket.emit('roomJoined', roomName);
            io.to(roomName).emit('startGame');
            console.log(`User ${socket.id} joined room ${roomName}`);
        } else {
            socket.emit('roomFull', roomName);
        }
    });

    socket.on('move', (data) => {
        const roomName = Object.keys(socket.rooms).find(room => room !== socket.id);
        if (roomName) {
            socket.to(roomName).emit('move', data);
        }
    });

    socket.on('gameOver', () => {
        const roomName = Object.keys(socket.rooms).find(room => room !== socket.id);
        if (roomName) {
            io.to(roomName).emit('gameOver');
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        for (const roomName in rooms) {
            const index = rooms[roomName].indexOf(socket.id);
            if (index !== -1) {
                rooms[roomName].splice(index, 1);
                if (rooms[roomName].length === 0) {
                    delete rooms[roomName];
                } else {
                    socket.to(roomName).emit('opponentLeft');
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
