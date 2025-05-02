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

// Store ready players for each room
const readyPlayers = new Map();

// Guardar timers ativos por sala
const roomTimers = new Map();

// Jogadores prontos para jogar de novo
const playAgainReady = new Map();

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
      totalRounds: Number(totalRounds) || 5,
      currentRound: 1,
      gameState: 'lobby',
      scores: {},
      currentSong: null,
      playerGuesses: {},
      correctGuesses: {},
      roundScores: {},
      timeLeft: 30,
      isPlaying: false,
      musicPreview: null,
    };
    socket.join(roomCode);
    callback({ success: true, roomCode, totalRounds });
    io.to(roomCode).emit('players_updated', { players: rooms[roomCode].players, scores: rooms[roomCode].scores });
  });

  // Entrar em sala
  socket.on('join_room', ({ roomCode }, callback) => {
    const room = rooms[roomCode];
    if (!room) return callback({ success: false, error: 'Room not found', isHost: false });
    
    if (room.gameState !== 'lobby' && room.gameState !== 'playerForm') {
      callback({
        success: false,
        error: "Game already started. You can't join now.",
      });
      return;
    }
    
    socket.join(roomCode);
    callback({
      success: true,
      isHost: room.host === socket.id,
      isPlaying: room.isPlaying,
      musicPreview: room.musicPreview,
      timeLeft: room.timeLeft,
      currentSong: room.currentSong,
      totalRounds: room.totalRounds,
    });
    
    // Emitir preview diretamente para o novo jogador, se houver
    if (room.musicPreview) {
      socket.emit("music_preview", { musicPreview: room.musicPreview });
    }
    
    io.to(roomCode).emit('players_updated', { players: room.players, scores: room.scores });
  });

  // Adicionar jogador
  socket.on('add_player', ({ roomCode, player }) => {
    const room = rooms[roomCode];
    if (!room) return;
    
    // Adicionar socketId ao jogador
    const playerWithSocket = {
      ...player,
      socketId: socket.id
    };
    
    room.players.push(playerWithSocket);
    room.scores[player.id] = 0;
    io.to(roomCode).emit('players_updated', { players: room.players, scores: room.scores });
  });

  // Iniciar jogo
  socket.on('start_game', ({ roomCode, song }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.host !== socket.id) return; // Só o host pode iniciar

    room.gameState = 'game';
    room.currentSong = song;
    room.playerGuesses = {};
    room.correctGuesses = {};
    room.roundScores = {};
    room.timeLeft = 30;
    room.isPlaying = false;

    // Inicializar lista de jogadores prontos
    readyPlayers.set(roomCode, new Set());

    // Enviar evento para todos se prepararem
    io.to(roomCode).emit('prepare_game', {
      gameState: 'game',
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      timeLeft: room.timeLeft,
    });
  });

  // Receber ready de cada jogador
  socket.on('player_ready', ({ roomCode, playerId }) => {
    if (!rooms[roomCode]) return;
    const room = rooms[roomCode];
    if (!readyPlayers.has(roomCode)) return;
    
    const set = readyPlayers.get(roomCode);
    set.add(playerId);
    
    // Quando todos estiverem prontos, avisar o host
    if (set.size === room.players.length) {
      io.to(room.host).emit('all_ready', { roomCode });
      readyPlayers.delete(roomCode);
    }
  });

  // Tocar/parar música
  socket.on('toggle_music', ({ roomCode, isPlaying }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.host !== socket.id) return; // Só o host pode controlar a música

    room.isPlaying = isPlaying;

    if (isPlaying) {
      // Start the timer when music starts playing
      // Guardar o timer para poder limpar depois
      if (roomTimers.has(roomCode)) {
        clearInterval(roomTimers.get(roomCode));
      }
      const timer = startTimer(roomCode);
      roomTimers.set(roomCode, timer);
    }

    io.to(roomCode).emit('music_toggled', { isPlaying });
  });

  // Submeter palpite
  socket.on('submit_guess', ({ roomCode, playerId, guess }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (!room.playerGuesses) room.playerGuesses = {};
    if (!room.correctGuesses) room.correctGuesses = {};
    
    // Só pode submeter uma vez por ronda e se o jogo estiver em andamento
    if (room.playerGuesses[playerId] || !room.isPlaying) return;
    
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
    
    // Fim automático da ronda se todos submeteram e ninguém acertou
    const totalPlayers = room.players.length;
    const totalGuesses = Object.keys(room.playerGuesses).length;
    const totalCorrect = Object.values(room.correctGuesses).filter(Boolean).length;
    
    if (totalGuesses === totalPlayers && totalCorrect === 0) {
      // Ninguém acertou, terminar ronda e mostrar resposta correta
      room.isPlaying = false;
      if (roomTimers.has(roomCode)) {
        clearInterval(roomTimers.get(roomCode));
        roomTimers.delete(roomCode);
      }
      io.to(roomCode).emit('all_failed', {
        correctAnswer: `${room.currentSong.character} (${room.currentSong.movie})`,
      });
      setTimeout(() => {
        // Avançar para o scoreboard normalmente
        endRoundAuto(roomCode);
      }, 3000); // 3 segundos para mostrar resposta
    }
    
    // Se todos submeteram e pelo menos um acertou, terminar ronda imediatamente
    if (totalGuesses === totalPlayers && totalCorrect > 0) {
      room.isPlaying = false;
      if (roomTimers.has(roomCode)) {
        clearInterval(roomTimers.get(roomCode));
        roomTimers.delete(roomCode);
      }
      // Chamar end_round como se fosse o host
      endRoundImmediate(roomCode, { id: room.host });
    }
  });

  // Função auxiliar para terminar ronda automaticamente
  function endRoundAuto(roomCode) {
    if (!rooms[roomCode]) return;
    const room = rooms[roomCode];
    // Calculate scores (ninguém acertou, logo ninguém ganha pontos)
    room.roundScores = {};
    room.gameState = "scoreboard";
    io.to(roomCode).emit("round_ended", {
      gameState: "scoreboard",
      roundScores: room.roundScores,
      scores: room.scores,
      correctAnswer: room.currentSong ? `${room.currentSong.character} (${room.currentSong.movie})` : "Marvel Character",
    });
  }

  // Função auxiliar para terminar ronda imediatamente (como o host)
  function endRoundImmediate(roomCode, socket) {
    if (!rooms[roomCode]) return;
    const room = rooms[roomCode];
    
    // Calculate scores
    const newScores = {};
    room.players.forEach((player) => {
      if (room.correctGuesses[player.id]) {
        newScores[player.id] = 10;
      }
    });
    room.roundScores = newScores;
    Object.keys(newScores).forEach((playerId) => {
      room.scores[playerId] = (room.scores[playerId] || 0) + newScores[playerId];
    });

    // Primeiro emitir que alguém acertou e esperar 3 segundos
    io.to(roomCode).emit("correct_answer", {
      correctAnswer: room.currentSong ? `${room.currentSong.character} (${room.currentSong.movie})` : "Marvel Character",
    });

    // Depois de 3 segundos, avançar para o scoreboard
    setTimeout(() => {
      room.gameState = "scoreboard";
      io.to(roomCode).emit("round_ended", {
        gameState: "scoreboard",
        roundScores: room.roundScores,
        scores: room.scores,
        correctAnswer: room.currentSong ? `${room.currentSong.character} (${room.currentSong.movie})` : "Marvel Character",
      });
    }, 3000);
  }

  // End round
  socket.on('end_round', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.host !== socket.id) return; // Só o host pode encerrar a ronda

    // Calculate scores
    const newScores = {};
    room.players.forEach((player) => {
      if (room.correctGuesses[player.id]) {
        newScores[player.id] = 10;
      }
    });

    room.roundScores = newScores;
    Object.keys(newScores).forEach((playerId) => {
      room.scores[playerId] = (room.scores[playerId] || 0) + newScores[playerId];
    });

    room.gameState = 'scoreboard';
    io.to(roomCode).emit('round_ended', {
      gameState: 'scoreboard',
      roundScores: room.roundScores,
      scores: room.scores,
      correctAnswer: room.currentSong ? `${room.currentSong.character} (${room.currentSong.movie})` : "Marvel Character",
    });
  });

  // Próxima ronda
  socket.on('next_round', ({ roomCode, song }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.host !== socket.id) return; // Só o host pode iniciar próxima ronda

    room.currentRound++;

    if (room.currentRound <= room.totalRounds) {
      room.gameState = 'game';
      room.currentSong = song;
      room.playerGuesses = {};
      room.correctGuesses = {};
      room.roundScores = {};
      room.timeLeft = 30;
      room.isPlaying = false;

      io.to(roomCode).emit('next_round_started', {
        gameState: 'game',
        currentRound: room.currentRound,
        totalRounds: room.totalRounds,
        timeLeft: room.timeLeft,
      });
    } else {
      room.gameState = 'gameOver';
      io.to(roomCode).emit('game_over', {
        gameState: 'gameOver',
        scores: room.scores,
      });
    }
  });

  // Jogador marca-se como pronto para jogar de novo
  socket.on('player_ready_for_next_game', ({ roomCode, playerId }) => {
    if (!playAgainReady.has(roomCode)) playAgainReady.set(roomCode, {});
    const ready = playAgainReady.get(roomCode);
    ready[playerId] = true;
    playAgainReady.set(roomCode, ready);
    // Emitir lista para todos
    io.to(roomCode).emit('ready_list', { readyPlayers: ready });
  });

  // Play again
  socket.on('play_again', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.host !== socket.id) return; // Só o host pode reiniciar o jogo

    // Só reiniciar com os jogadores prontos
    let ready = playAgainReady.get(roomCode) || {};
    const readyPlayerIds = Object.keys(ready).filter((id) => ready[id]);
    room.players = room.players.filter((p) => readyPlayerIds.includes(p.id));
    room.currentRound = 1;
    room.gameState = 'lobby';
    room.scores = Object.fromEntries(room.players.map((p) => [p.id, 0]));
    room.playerGuesses = {};
    room.correctGuesses = {};
    room.roundScores = {};

    playAgainReady.delete(roomCode);
    io.to(roomCode).emit('game_reset', {
      gameState: 'lobby',
      scores: room.scores,
    });
  });

  // Desconexão
  socket.on('disconnect', () => {
    // Encontrar salas onde este socket é jogador ou host
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      // Se o host desconectar, remover a sala e notificar todos
      if (room.host === socket.id) {
        io.to(roomCode).emit('host_disconnected');
        
        // Limpar timers ativos da sala
        if (roomTimers.has(roomCode)) {
          clearInterval(roomTimers.get(roomCode));
          roomTimers.delete(roomCode);
        }
        
        // Remover sala e dados associados
        delete rooms[roomCode];
        if (readyPlayers.has(roomCode)) {
          readyPlayers.delete(roomCode);
        }
        if (playAgainReady.has(roomCode)) {
          playAgainReady.delete(roomCode);
        }
        continue;
      }

      // Remover jogador da sala
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const playerId = room.players[playerIndex].id;
        room.players.splice(playerIndex, 1);

        // Se não restar jogadores, remover a sala
        if (room.players.length === 0) {
          delete rooms[roomCode];
        } else {
          io.to(roomCode).emit('players_updated', {
            players: room.players,
            scores: room.scores,
          });
        }
      }
    }
    console.log('Client disconnected:', socket.id);
  });

  // Novo evento: music_preview
  socket.on('music_preview', ({ roomCode, musicPreview }) => {
    if (!rooms[roomCode]) return;
    const room = rooms[roomCode];
    room.musicPreview = musicPreview;
    io.to(roomCode).emit('music_preview', { musicPreview });
  });

  // Novo evento: music_info
  socket.on('music_info', ({ roomCode, musicInfo }) => {
    if (!rooms[roomCode]) return;
    const room = rooms[roomCode];
    room.musicInfo = musicInfo;
    io.to(roomCode).emit('music_info', { musicInfo });
  });

  // Novo evento para sincronizar transição para resultados finais
  socket.on('show_final_results', ({ roomCode }) => {
    if (!rooms[roomCode]) return;
    const room = rooms[roomCode];
    // Apenas o host pode iniciar esta transição
    if (room.host !== socket.id) return;
    
    io.to(roomCode).emit('final_results_shown');
  });
});

// Timer function for countdown
function startTimer(roomCode) {
  if (!rooms[roomCode]) return;

  const room = rooms[roomCode];

  const timerInterval = setInterval(() => {
    if (!rooms[roomCode]) {
      clearInterval(timerInterval);
      return;
    }

    const currentRoom = rooms[roomCode];

    if (!currentRoom.isPlaying || currentRoom.gameState !== 'game') {
      clearInterval(timerInterval);
      return;
    }

    currentRoom.timeLeft--;

    if (currentRoom.timeLeft <= 0) {
      currentRoom.timeLeft = 0;
      currentRoom.isPlaying = false;
      clearInterval(timerInterval);

      // Calculate scores automatically when time runs out
      const newScores = {};
      let rank = 1;

      // Sort players by who answered correctly first
      const correctPlayers = currentRoom.players
        .filter((p) => currentRoom.correctGuesses[p.id])
        .sort((a, b) => {
          const aTime = currentRoom.playerGuesses[a.id]
            ? currentRoom.players.findIndex((p) => p.id === a.id)
            : Number.POSITIVE_INFINITY;
          const bTime = currentRoom.playerGuesses[b.id]
            ? currentRoom.players.findIndex((p) => p.id === b.id)
            : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        });

      // Assign points based on rank
      correctPlayers.forEach((player) => {
        newScores[player.id] = Math.max(10 - (rank - 1) * 2, 1);
        rank++;
      });

      currentRoom.roundScores = newScores;

      io.to(roomCode).emit('timer_updated', {
        timeLeft: 0,
        isPlaying: false,
        roundScores: newScores,
      });

      // After a short delay, end the round
      setTimeout(() => {
        currentRoom.gameState = 'scoreboard';
        
        // Update total scores
        Object.keys(newScores).forEach((playerId) => {
          currentRoom.scores[playerId] = (currentRoom.scores[playerId] || 0) + newScores[playerId];
        });
        
        io.to(roomCode).emit('round_ended', {
          gameState: 'scoreboard',
          roundScores: currentRoom.roundScores,
          scores: currentRoom.scores,
          correctAnswer: currentRoom.currentSong ? `${currentRoom.currentSong.character} (${currentRoom.currentSong.movie})` : "Marvel Character",
        });
      }, 3000);

      return;
    }

    // Send timer update to all clients in the room
    io.to(roomCode).emit('timer_updated', {
      timeLeft: currentRoom.timeLeft,
      isPlaying: currentRoom.isPlaying,
    });
  }, 1000);

  return timerInterval;
}

app.get('/', (req, res) => {
  res.send('Servidor com Socket.IO está a funcionar!');
});

app.use('/shazam', shazamRouter);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Servidor Socket.IO a correr na porta ${PORT}`);
});
