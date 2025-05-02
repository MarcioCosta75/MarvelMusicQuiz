const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { generateRoomCode } = require('./utils');
const shazamRouter = require('./shazam');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Estrutura em memória para salas e jogadores
const rooms = {};

// Função para normalizar strings para comparação
function normalizeString(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Função para verificar se uma string contém outra, independente da ordem das palavras
function fuzzyMatch(guess, target) {
  const normalizedGuess = normalizeString(guess);
  const normalizedTarget = normalizeString(target);
  if (normalizedGuess === normalizedTarget) return true;
  const guessWords = normalizedGuess.split(' ');
  const targetWords = normalizedTarget.split(' ');
  return guessWords.every(word =>
    word.length < 3 || targetWords.some(targetWord =>
      targetWord.includes(word) || word.includes(targetWord)
    )
  );
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Criar sala
  socket.on('create_room', ({ totalRounds }, callback) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      host: socket.id,
      players: [],
      totalRounds,
      currentRound: 1,
      gameState: 'lobby',
      scores: {},
      currentSong: null,
      isPlaying: false,
      playAgainReady: {},
    };
    socket.join(roomCode);
    callback({ success: true, roomCode, totalRounds });
    io.to(roomCode).emit('players_updated', { players: rooms[roomCode].players, scores: rooms[roomCode].scores });
  });

  // Entrar em sala
  socket.on('join_room', ({ roomCode }, callback) => {
    const room = rooms[roomCode];
    if (!room) return callback({ success: false, error: 'Room not found', isHost: false });
    socket.join(roomCode);
    callback({
      success: true,
      isHost: room.host === socket.id,
      isPlaying: room.isPlaying,
      musicPreview: room.currentSong?.preview || null,
      timeLeft: 30,
      currentSong: room.currentSong,
      totalRounds: room.totalRounds,
    });
    io.to(roomCode).emit('players_updated', { players: room.players, scores: room.scores });
  });

  // Adicionar jogador
  socket.on('add_player', ({ roomCode, player }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (!room.players.find(p => p.id === player.id)) {
      room.players.push(player);
      room.scores[player.id] = 0;
      io.to(roomCode).emit('players_updated', { players: room.players, scores: room.scores });
    }
  });

  // Iniciar jogo
  socket.on('start_game', ({ roomCode, song }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.gameState = 'game';
    room.currentSong = song;
    room.currentRound = 1;
    room.isPlaying = true;
    io.to(roomCode).emit('game_started', { gameState: 'game', currentRound: 1, totalRounds: room.totalRounds });
    io.to(roomCode).emit('current_song', { currentSong: song });
  });

  // Tocar/parar música
  socket.on('toggle_music', ({ roomCode, isPlaying }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.isPlaying = isPlaying;
    io.to(roomCode).emit('music_toggled', { isPlaying });
  });

  // Submeter palpite
  socket.on('submit_guess', ({ roomCode, playerId, guess }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (!room.playerGuesses) room.playerGuesses = {};
    if (!room.correctGuesses) room.correctGuesses = {};
    // Só pode submeter uma vez por ronda
    if (room.playerGuesses[playerId]) return;
    room.playerGuesses[playerId] = guess;
    // Validação: acerta se personagem OU filme
    const isCorrect =
      fuzzyMatch(guess, room.currentSong?.character || '') ||
      fuzzyMatch(guess, room.currentSong?.movie || '');
    room.correctGuesses[playerId] = isCorrect;
    // Atualizar placar se acertou
    if (isCorrect) {
      room.scores[playerId] = (room.scores[playerId] || 0) + 10;
    }
    io.to(roomCode).emit('guess_submitted', {
      playerGuesses: room.playerGuesses,
      correctGuesses: room.correctGuesses,
      scores: room.scores,
    });
  });

  // Terminar ronda
  socket.on('end_round', (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.gameState = 'scoreboard';
    io.to(roomCode).emit('round_ended', { gameState: 'scoreboard', roundScores: room.scores, scores: room.scores });
  });

  // Próxima ronda
  socket.on('next_round', ({ roomCode, song }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.currentRound += 1;
    room.currentSong = song;
    room.gameState = 'game';
    io.to(roomCode).emit('next_round_started', { gameState: 'game', currentRound: room.currentRound, totalRounds: room.totalRounds });
    io.to(roomCode).emit('current_song', { currentSong: song });
  });

  // Jogar novamente
  socket.on('play_again', (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.currentRound = 1;
    room.scores = {};
    room.gameState = 'lobby';
    room.currentSong = null;
    room.isPlaying = false;
    room.playAgainReady = {};
    io.to(roomCode).emit('game_reset', { gameState: 'lobby', scores: room.scores });
  });

  // Desconexão
  socket.on('disconnect', () => {
    // Remover jogador de todas as salas
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      room.players = room.players.filter(p => p.socketId !== socket.id);
      if (room.host === socket.id) {
        io.to(roomCode).emit('host_disconnected');
        delete rooms[roomCode];
      } else {
        io.to(roomCode).emit('players_updated', { players: room.players, scores: room.scores });
      }
    }
    console.log('Client disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('Servidor com Socket.IO está a funcionar!');
});

app.use('/shazam', shazamRouter);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Servidor Socket.IO a correr na porta ${PORT}`);
});
