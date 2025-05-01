require("dotenv").config()
const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const { generateRoomCode } = require("./utils")
const shazamRouter = require("./shazam")

const app = express()
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? ["https://marvel-music-quiz.vercel.app", "https://marvelmusicquiz-production.up.railway.app"]
    : "http://localhost:3000",
  credentials: true
}))
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production"
      ? ["https://marvel-music-quiz.vercel.app", "https://marvelmusicquiz-production.up.railway.app"]
      : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  upgradeTimeout: 30000,
  cookie: false
})

// Log connection events
io.engine.on("connection_error", (err) => {
  console.log("Connection error:", err);
});

io.engine.on("headers", (headers, req) => {
  console.log("Headers:", headers);
});

// Store active rooms and their data
const rooms = new Map()

// Store ready players for each room
const readyPlayers = new Map()

// Guardar timers ativos por sala
const roomTimers = new Map()

// Jogadores prontos para jogar de novo
const playAgainReady = new Map()

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`)

  // Create a new room
  socket.on("create_room", ({ totalRounds }, callback) => {
    console.log("Creating room with rounds:", totalRounds) // Debug log
    const roomCode = generateRoomCode()

    const validatedTotalRounds = Number(totalRounds) || 5 // Garantir que é um número
    console.log("Validated rounds:", validatedTotalRounds) // Debug log

    rooms.set(roomCode, {
      players: [],
      host: socket.id,
      gameState: "lobby",
      currentRound: 1,
      totalRounds: validatedTotalRounds,
      scores: {},
      currentSong: null,
      playerGuesses: {},
      correctGuesses: {},
      roundScores: {},
      timeLeft: 30,
      isPlaying: false,
      musicPreview: null,
    })

    socket.join(roomCode)

    const response = {
      success: true,
      roomCode,
      totalRounds: validatedTotalRounds,
    }
    console.log("Room created response:", response) // Debug log

    callback(response)

    console.log(`Room created: ${roomCode} by ${socket.id} with ${validatedTotalRounds} rounds`)
  })

  // Join an existing room
  socket.on("join_room", ({ roomCode }, callback) => {
    if (!rooms.has(roomCode)) {
      callback({
        success: false,
        error: "Room not found",
      })
      return
    }

    const room = rooms.get(roomCode)
    if (room.gameState !== "lobby" && room.gameState !== "playerForm") {
      callback({
        success: false,
        error: "Game already started. You can't join now.",
      })
      return
    }

    socket.join(roomCode)
    console.log(`[join_room] Socket ${socket.id} joined room ${roomCode}. Rooms:`, Array.from(socket.rooms))

    callback({
      success: true,
      roomCode,
      isHost: room.host === socket.id,
      isPlaying: room.isPlaying,
      musicPreview: room.musicPreview,
      timeLeft: room.timeLeft,
      currentSong: room.currentSong,
      totalRounds: room.totalRounds, // Adicionar totalRounds na resposta
    })

    // Emitir preview diretamente para o novo jogador, se houver
    if (room.musicPreview) {
      socket.emit("music_preview", { musicPreview: room.musicPreview })
    }

    // Se o jogo já começou, emitir game_started, music_preview e music_toggled para o novo jogador
    if (room.gameState === "game") {
      socket.emit("game_started", {
        gameState: "game",
        currentRound: room.currentRound,
        totalRounds: room.totalRounds,
        timeLeft: room.timeLeft,
    })
      socket.emit("music_preview", { musicPreview: room.musicPreview })
      socket.emit("music_toggled", { isPlaying: room.isPlaying })
      if (room.currentSong) {
        socket.emit("current_song", { currentSong: room.currentSong })
      }
      if (room.musicInfo) {
        socket.emit("music_info", { musicInfo: room.musicInfo })
      }
    }

    console.log(`User ${socket.id} joined room: ${roomCode}`)
  })

  // Add player to room
  socket.on("add_player", ({ roomCode, player }) => {
    if (!rooms.has(roomCode)) return

    const room = rooms.get(roomCode)

    // Initialize player's score
    room.scores[player.id] = 0

    // Add player to room
    room.players.push({
      ...player,
      socketId: socket.id,
    })

    // Update room data
    rooms.set(roomCode, room)

    // Broadcast updated player list to all clients in the room
    io.to(roomCode).emit("players_updated", {
      players: room.players,
      scores: room.scores,
    })

    console.log(`[add_player] Socket ${socket.id} should be in room ${roomCode}. Rooms:`, Array.from(socket.rooms))
    console.log(`Player ${player.name} added to room ${roomCode}`)
  })

  // Start game
  socket.on("start_game", ({ roomCode, song }) => {
    if (!rooms.has(roomCode)) return

    const room = rooms.get(roomCode)

    // Only host can start the game
    if (room.host !== socket.id) return

    room.gameState = "game"
    room.currentSong = song
    room.playerGuesses = {}
    room.correctGuesses = {}
    room.roundScores = {}
    room.timeLeft = 30
    room.isPlaying = false

    rooms.set(roomCode, room)

    // Inicializar lista de jogadores prontos
    readyPlayers.set(roomCode, new Set())

    // Enviar evento para todos se prepararem
    io.to(roomCode).emit("prepare_game", {
      gameState: "game",
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      timeLeft: room.timeLeft,
    })

    console.log(`[start_game] Emitting prepare_game to room ${roomCode}. Sockets in room:`, Array.from(io.sockets.adapter.rooms.get(roomCode) || []))
  })

  // Receber ready de cada jogador
  socket.on("player_ready", ({ roomCode, playerId }) => {
    if (!rooms.has(roomCode)) return;
    const room = rooms.get(roomCode);
    if (!readyPlayers.has(roomCode)) return;
    const set = readyPlayers.get(roomCode);
    set.add(playerId);
    // Quando todos estiverem prontos, avisar o host
    if (set.size === room.players.length) {
      io.to(room.host).emit("all_ready", { roomCode });
      readyPlayers.delete(roomCode);
    }
  });

  // Toggle music play state
  socket.on("toggle_music", ({ roomCode, isPlaying }) => {
    if (!rooms.has(roomCode)) return

    const room = rooms.get(roomCode)

    // Only host can control music
    if (room.host !== socket.id) return

    room.isPlaying = isPlaying

    if (isPlaying) {
      // Start the timer when music starts playing
      // Guardar o timer para poder limpar depois
      if (roomTimers.has(roomCode)) {
        clearInterval(roomTimers.get(roomCode));
      }
      const timer = startTimer(roomCode)
      roomTimers.set(roomCode, timer)
    }

    rooms.set(roomCode, room)

    io.to(roomCode).emit("music_toggled", {
      isPlaying,
    })
  })

  // Submit guess
  socket.on("submit_guess", ({ roomCode, playerId, guess }) => {
    if (!rooms.has(roomCode)) return

    const room = rooms.get(roomCode)

    // Don't accept guesses if player already guessed or game not in progress
    if (room.playerGuesses[playerId] || !room.isPlaying) return

    room.playerGuesses[playerId] = guess

    // Função para normalizar strings para comparação
    function normalizeString(str) {
      return str
        .toLowerCase()
        // Remover acentos
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        // Substituir hífens e underscores por espaços
        .replace(/[-_]/g, " ")
        // Remover caracteres especiais e pontuação, mas manter espaços
        .replace(/[^a-z0-9\s]/g, "")
        // Substituir múltiplos espaços por um único
        .replace(/\s+/g, " ")
        // Remover espaços no início e fim
        .trim();
    }

    // Função para verificar se uma string contém outra, independente da ordem das palavras
    function fuzzyMatch(guess, target) {
      const normalizedGuess = normalizeString(guess);
      const normalizedTarget = normalizeString(target);

      // Se for uma correspondência exata após normalização
      if (normalizedGuess === normalizedTarget) return true;

      // Dividir em palavras
      const guessWords = normalizedGuess.split(" ");
      const targetWords = normalizedTarget.split(" ");

      // Verificar se todas as palavras do guess estão no target
      return guessWords.every(word => 
        // A palavra deve ter pelo menos 3 caracteres para ser considerada
        word.length < 3 || targetWords.some(targetWord => 
          targetWord.includes(word) || word.includes(targetWord)
        )
      );
    }

    // Check if correct using fuzzy matching
    const isCorrect =
      fuzzyMatch(guess, room.currentSong.character) ||
      fuzzyMatch(guess, room.currentSong.movie);

    room.correctGuesses[playerId] = isCorrect

    rooms.set(roomCode, room)

    io.to(roomCode).emit("guess_submitted", {
      playerGuesses: room.playerGuesses,
      correctGuesses: room.correctGuesses,
    })

    // Fim automático da ronda se todos submeteram e ninguém acertou
    const totalPlayers = room.players.length;
    const totalGuesses = Object.keys(room.playerGuesses).length;
    const totalCorrect = Object.values(room.correctGuesses).filter(Boolean).length;
    if (totalGuesses === totalPlayers && totalCorrect === 0) {
      // Ninguém acertou, terminar ronda e mostrar resposta correta
      room.isPlaying = false;
      rooms.set(roomCode, room);
      if (roomTimers.has(roomCode)) {
        clearInterval(roomTimers.get(roomCode));
        roomTimers.delete(roomCode);
      }
      io.to(roomCode).emit("all_failed", {
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
      rooms.set(roomCode, room);
      if (roomTimers.has(roomCode)) {
        clearInterval(roomTimers.get(roomCode));
        roomTimers.delete(roomCode);
      }
      // Chamar end_round como se fosse o host
      const fakeHostSocket = { id: room.host };
      endRoundImmediate(roomCode, fakeHostSocket);
    }
  })

  // Função auxiliar para terminar ronda automaticamente
  function endRoundAuto(roomCode) {
    if (!rooms.has(roomCode)) return;
    const room = rooms.get(roomCode);
    // Calculate scores (ninguém acertou, logo ninguém ganha pontos)
    room.roundScores = {};
    room.gameState = "scoreboard";
    rooms.set(roomCode, room);
    io.to(roomCode).emit("round_ended", {
      gameState: "scoreboard",
      roundScores: room.roundScores,
      scores: room.scores,
      correctAnswer: room.currentSong ? `${room.currentSong.character} (${room.currentSong.movie})` : "Marvel Character",
    });
  }

  // Função auxiliar para terminar ronda imediatamente (como o host)
  function endRoundImmediate(roomCode, socket) {
    if (!rooms.has(roomCode)) return
    const room = rooms.get(roomCode)
    
    // Calculate scores
    const newScores = {}
    room.players.forEach((player) => {
      if (room.correctGuesses[player.id]) {
        newScores[player.id] = 10;
      }
    });
    room.roundScores = newScores
    Object.keys(newScores).forEach((playerId) => {
      room.scores[playerId] = (room.scores[playerId] || 0) + newScores[playerId]
    })

    // Primeiro emitir que alguém acertou e esperar 3 segundos
    io.to(roomCode).emit("correct_answer", {
      correctAnswer: room.currentSong ? `${room.currentSong.character} (${room.currentSong.movie})` : "Marvel Character",
    });

    // Depois de 3 segundos, avançar para o scoreboard
    setTimeout(() => {
      room.gameState = "scoreboard"
      rooms.set(roomCode, room)
      io.to(roomCode).emit("round_ended", {
        gameState: "scoreboard",
        roundScores: room.roundScores,
        scores: room.scores,
        correctAnswer: room.currentSong ? `${room.currentSong.character} (${room.currentSong.movie})` : "Marvel Character",
      })
    }, 3000)
  }

  // End round
  socket.on("end_round", ({ roomCode }) => {
    if (!rooms.has(roomCode)) return

    const room = rooms.get(roomCode)

    // Only host can end round
    if (room.host !== socket.id) return

    // Calculate scores
    const newScores = {}
    // Todos os que acertaram ganham 10 pontos
    room.players.forEach((player) => {
      if (room.correctGuesses[player.id]) {
        newScores[player.id] = 10;
      }
    });

    room.roundScores = newScores

    // Update total scores
    Object.keys(newScores).forEach((playerId) => {
      room.scores[playerId] = (room.scores[playerId] || 0) + newScores[playerId]
    })

    room.gameState = "scoreboard"
    rooms.set(roomCode, room)

    io.to(roomCode).emit("round_ended", {
      gameState: "scoreboard",
      roundScores: room.roundScores,
      scores: room.scores,
      correctAnswer: room.currentSong ? `${room.currentSong.character} (${room.currentSong.movie})` : "Marvel Character",
    })
  })

  // Next round
  socket.on("next_round", ({ roomCode, song }) => {
    if (!rooms.has(roomCode)) return

    const room = rooms.get(roomCode)

    // Only host can start next round
    if (room.host !== socket.id) return

    room.currentRound++

    if (room.currentRound <= room.totalRounds) {
      room.gameState = "game"
      room.currentSong = song
      room.playerGuesses = {}
      room.correctGuesses = {}
      room.roundScores = {}
      room.timeLeft = 30
      room.isPlaying = false

      rooms.set(roomCode, room)

      io.to(roomCode).emit("next_round_started", {
        gameState: "game",
        currentRound: room.currentRound,
        totalRounds: room.totalRounds,
        timeLeft: room.timeLeft,
      })
    } else {
      room.gameState = "gameOver"

      rooms.set(roomCode, room)

      io.to(roomCode).emit("game_over", {
        gameState: "gameOver",
        scores: room.scores,
      })
    }
  })

  // Jogador marca-se como pronto para jogar de novo
  socket.on("player_ready_for_next_game", ({ roomCode, playerId }) => {
    if (!playAgainReady.has(roomCode)) playAgainReady.set(roomCode, {});
    const ready = playAgainReady.get(roomCode);
    ready[playerId] = true;
    playAgainReady.set(roomCode, ready);
    // Emitir lista para todos
    io.to(roomCode).emit("ready_list", { readyPlayers: ready });
  });

  // Play again
  socket.on("play_again", ({ roomCode }) => {
    if (!rooms.has(roomCode)) return

    const room = rooms.get(roomCode)

    // Only host can restart game
    if (room.host !== socket.id) return

    // Só reiniciar com os jogadores prontos
    let ready = playAgainReady.get(roomCode) || {};
    const readyPlayerIds = Object.keys(ready).filter((id) => ready[id]);
    room.players = room.players.filter((p) => readyPlayerIds.includes(p.id));
    room.currentRound = 1
    room.gameState = "lobby"
    room.scores = Object.fromEntries(room.players.map((p) => [p.id, 0]))
    room.playerGuesses = {}
    room.correctGuesses = {}
    room.roundScores = {}

    rooms.set(roomCode, room)
    playAgainReady.delete(roomCode)

    io.to(roomCode).emit("game_reset", {
      gameState: "lobby",
      scores: room.scores,
    })
  })

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`)

    // Find rooms where this socket is a player or host
    for (const [roomCode, room] of rooms.entries()) {
      // If host disconnects, remove the room and notify all players
      if (room.host === socket.id) {
        io.to(roomCode).emit("host_disconnected")
        
        // Clear any active timers for the room
        if (roomTimers.has(roomCode)) {
          clearInterval(roomTimers.get(roomCode))
          roomTimers.delete(roomCode)
        }
        
        // Remove the room and any associated data
        rooms.delete(roomCode)
        if (readyPlayers.has(roomCode)) {
          readyPlayers.delete(roomCode)
        }
        if (playAgainReady.has(roomCode)) {
          playAgainReady.delete(roomCode)
        }
        continue
      }

      // Remove player from room
      const playerIndex = room.players.findIndex((p) => p.socketId === socket.id)

      if (playerIndex !== -1) {
        const playerId = room.players[playerIndex].id
        room.players.splice(playerIndex, 1)

        // If no players left, remove the room
        if (room.players.length === 0) {
          rooms.delete(roomCode)
        } else {
          rooms.set(roomCode, room)
          io.to(roomCode).emit("players_updated", {
            players: room.players,
            scores: room.scores,
          })
        }
      }
    }
  })

  // Novo evento: music_preview
  socket.on("music_preview", ({ roomCode, musicPreview }) => {
    if (!rooms.has(roomCode)) return
    const room = rooms.get(roomCode)
    room.musicPreview = musicPreview
    rooms.set(roomCode, room)
    io.to(roomCode).emit("music_preview", { musicPreview })
  })

  // Novo evento: music_info
  socket.on("music_info", ({ roomCode, musicInfo }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.musicInfo = musicInfo;
      rooms.set(roomCode, room);
    }
    io.to(roomCode).emit("music_info", { musicInfo });
  })

  // Novo evento para sincronizar transição para resultados finais
  socket.on("show_final_results", ({ roomCode }) => {
    if (!rooms.has(roomCode)) return;
    const room = rooms.get(roomCode);
    // Apenas o host pode iniciar esta transição
    if (room.host !== socket.id) return;
    
    io.to(roomCode).emit("final_results_shown");
  });
})

// Calculate scores based on correct guesses and player order
function calculateRoundScores(players, correctGuesses, playerGuesses) {
  const newScores = {};
  let rank = 1;

  // Sort players by who answered correctly first
  const correctPlayers = players
    .filter((p) => correctGuesses[p.id])
    .sort((a, b) => {
      const aTime = playerGuesses[a.id]
        ? players.findIndex((p) => p.id === a.id)
        : Number.POSITIVE_INFINITY;
      const bTime = playerGuesses[b.id]
        ? players.findIndex((p) => p.id === b.id)
        : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });

  // Assign points based on rank
  correctPlayers.forEach((player) => {
    newScores[player.id] = Math.max(10 - (rank - 1) * 2, 1);
    rank++;
  });

  return newScores;
}

// Timer function for countdown
function startTimer(roomCode) {
  if (!rooms.has(roomCode)) return;

  const room = rooms.get(roomCode);

  const timerInterval = setInterval(() => {
    if (!rooms.has(roomCode)) {
      clearInterval(timerInterval);
      return;
    }

    const currentRoom = rooms.get(roomCode);

    if (!currentRoom.isPlaying || currentRoom.gameState !== "game") {
      clearInterval(timerInterval);
      return;
    }

    currentRoom.timeLeft--;

    if (currentRoom.timeLeft <= 0) {
      currentRoom.timeLeft = 0;
      currentRoom.isPlaying = false;
      clearInterval(timerInterval);

      // Calculate scores using the extracted function
      currentRoom.roundScores = calculateRoundScores(
        currentRoom.players,
        currentRoom.correctGuesses,
        currentRoom.playerGuesses
      );
    }

    rooms.set(roomCode, currentRoom);

    io.to(roomCode).emit("timer_updated", {
      timeLeft: currentRoom.timeLeft,
      isPlaying: currentRoom.isPlaying,
      roundScores: currentRoom.timeLeft === 0 ? currentRoom.roundScores : {},
    });
  }, 1000);

  return timerInterval;
}

// Utils
// function generateRoomCode() {
//   const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
//   let result = '';
//   for (let i = 0; i < 6; i++) {
//     result += characters.charAt(Math.floor(Math.random() * characters.length));
//   }
//   return result;
// }

app.use("/shazam", shazamRouter)

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
