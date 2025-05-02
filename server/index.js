const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  socket.on('message', (data) => {
    io.emit('message', data); // Broadcast para todos
  });
});

app.get('/', (req, res) => {
  res.send('Servidor com Socket.IO está a funcionar!');
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Servidor Socket.IO a correr na porta ${PORT}`);
});
