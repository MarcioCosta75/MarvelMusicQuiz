"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PlayerForm from "@/components/player-form"
import RoomLobby from "@/components/room-lobby"
import GameScreen from "@/components/game-screen"
import Scoreboard from "@/components/scoreboard"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSocket } from "@/context/socket-context"
import { marvelSongs } from "@/lib/marvel-songs"
import type { Player, GameState, MarvelSong } from "@/lib/types"
import { ComicPanel } from "./comic-effects"
import { SpeechBubble } from "./speech-bubble"
import { ComicText } from "./comic-effects"
import type { JoinRoomResponse } from "@/context/socket-context"
import HostDisconnected from "./host-disconnected"

export default function LandingPage() {
  const { createRoom, joinRoom, addPlayer, startGame, endRound, nextRound, playAgain, socket } = useSocket()
  const [gameState, setGameState] = useState<GameState>("landing")
  const [roomCode, setRoomCode] = useState<string>("")
  const [joinRoomCode, setJoinRoomCode] = useState<string>("")
  const [selectedRounds, setSelectedRounds] = useState<number>(5)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [isHost, setIsHost] = useState<boolean>(false)
  const [round, setRound] = useState<number>(1)
  const [totalRounds, setTotalRounds] = useState<number>(5)
  const [currentSong, setCurrentSong] = useState<MarvelSong | null>(null)
  const [initialIsPlaying, setInitialIsPlaying] = useState<boolean>(false)
  const [initialMusicPreview, setInitialMusicPreview] = useState<string | null>(null)
  const [initialTimeLeft, setInitialTimeLeft] = useState<number>(30)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState<string>("")
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [playAgainReady, setPlayAgainReady] = useState<Record<string, boolean>>({})
  const [showDisconnected, setShowDisconnected] = useState(false)

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return

    // Listen for player updates
    socket.on("players_updated", ({ players, scores }) => {
      setPlayers(players)
      setScores(scores)
    })

    // Listen for prepare_game (novo fluxo)
    socket.on("prepare_game", ({ gameState, currentRound, totalRounds, timeLeft }) => {
      setGameState("game")
      setRound(currentRound)
      setInitialTimeLeft(timeLeft)
      // Enviar player_ready para o backend
      if (currentPlayer) {
        socket.emit("player_ready", { roomCode, playerId: currentPlayer.id })
      }
    })

    // Listen for all_ready (apenas host faz fetch da música)
    socket.on("all_ready", ({ roomCode: readyRoomCode }) => {
      if (isHost && readyRoomCode === roomCode) {
        console.log("[socket] all_ready recebido, escolhendo música");
        const randomIndex = Math.floor(Math.random() * marvelSongs.length)
        const song = marvelSongs[randomIndex]
        setCurrentSong(song)
        // Emitir para todos a música selecionada
        socket.emit("current_song", { roomCode, currentSong: song });
        // O GameScreen do host fará fetch e emitirá para todos
      }
    })

    // Listen for game state changes
    socket.on("game_started", ({ gameState, currentRound, totalRounds }) => {
      console.log("[socket] game_started recebido!")
      setGameState(gameState)
      setRound(currentRound)
    })

    // Listen for current_song event
    socket.on("current_song", ({ currentSong }) => {
      console.log("[socket] current_song recebido:", currentSong?.title)
      if (currentSong) {
        setCurrentSong(currentSong)
      } else {
        console.error("[socket] current_song recebido sem música definida");
      }
    })

    socket.on("round_ended", ({ gameState, roundScores, scores, correctAnswer }) => {
      setGameState(gameState)
      setScores(scores)
      if (correctAnswer) setLastCorrectAnswer(correctAnswer)
    })

    socket.on("next_round_started", ({ gameState, currentRound, totalRounds }) => {
      setGameState(gameState)
      setRound(currentRound)
    })

    socket.on("game_over", ({ gameState, scores }) => {
      setGameState(gameState)
      setScores(scores)
      setShowLeaderboard(true)
      setPlayAgainReady({})
    })

    socket.on("game_reset", ({ gameState, scores }) => {
      setGameState(gameState)
      setRound(1)
      setScores(scores)
    })

    socket.on("host_disconnected", () => {
      setShowDisconnected(true)
      // Reset game state after a short delay
      setTimeout(() => {
        setGameState("landing")
        setRoomCode("")
        setPlayers([])
        setCurrentPlayer(null)
        setScores({})
        setIsHost(false)
        setRound(1)
        setShowDisconnected(false)
      }, 5000) // 5 seconds delay before resetting
    })

    // Receber lista de prontos do backend
    const handleReadyList = ({ readyPlayers }: { readyPlayers: Record<string, boolean> }) => {
      setPlayAgainReady(readyPlayers)
    }
    socket.on("ready_list", handleReadyList)

    // Adicionar listener para o evento de resultados finais
    socket.on("final_results_shown", () => {
      console.log("[socket] final_results_shown recebido");
      setGameState("final_results");
    })

    // Listen for music preview
    socket.on("music_preview", ({ musicPreview }) => {
      setInitialMusicPreview(musicPreview)
    })

    // Listen for music info
    socket.on("music_info", ({ musicInfo }) => {
      // Handle music info if needed
    })

    // Listen for all failed
    socket.on("all_failed", ({ correctAnswer }) => {
      setLastCorrectAnswer(correctAnswer)
    })

    // Listen for correct answer
    socket.on("correct_answer", ({ correctAnswer }) => {
      setLastCorrectAnswer(correctAnswer)
    })

    return () => {
      // Clean up event listeners
      socket.off("players_updated")
      socket.off("prepare_game")
      socket.off("all_ready")
      socket.off("game_started")
      socket.off("current_song")
      socket.off("round_ended")
      socket.off("next_round_started")
      socket.off("game_over")
      socket.off("game_reset")
      socket.off("host_disconnected")
      socket.off("ready_list", handleReadyList)
      socket.off("final_results_shown")
      socket.off("music_preview")
      socket.off("music_info")
      socket.off("all_failed")
      socket.off("correct_answer")
    }
  }, [socket, roomCode, currentPlayer, isHost])

  const handleCreateRoom = useCallback(async () => {
    console.log("Creating room with rounds:", selectedRounds) // Debug log
    const response = await createRoom({ totalRounds: selectedRounds })
    console.log("Room created response:", response) // Debug log
    if (response.success) {
      setRoomCode(response.roomCode)
      setIsHost(true)
      setGameState("playerForm")
      setTotalRounds(response.totalRounds)
    }
  }, [createRoom, selectedRounds])

  const handleJoinRoom = useCallback(async () => {
    if (joinRoomCode.length === 6) {
      const response: JoinRoomResponse = await joinRoom(joinRoomCode)
      if (response.success) {
        setRoomCode(joinRoomCode)
        setIsHost(response.isHost)
        setInitialIsPlaying(response.isPlaying ?? false)
        setInitialMusicPreview(response.musicPreview ?? null)
        setInitialTimeLeft(response.timeLeft ?? 30)
        if (response.currentSong) setCurrentSong(response.currentSong)
        setGameState("playerForm")
        setJoinError(null)
      } else {
        setJoinError(response.error || "Failed to join room")
      }
    }
  }, [joinRoom, joinRoomCode])

  const handlePlayerFormSubmit = useCallback(
    (player: Player) => {
      setCurrentPlayer(player)

      // Use the socket context to add player to room
      addPlayer(roomCode, player)

      setGameState("lobby")
    },
    [addPlayer, roomCode],
  )

  const handleStartGame = useCallback(() => {
    if (!isHost) return
    const randomIndex = Math.floor(Math.random() * marvelSongs.length)
    const song = marvelSongs[randomIndex]
    setCurrentSong(song)
    startGame(roomCode, song)
  }, [isHost, roomCode, startGame])

  const handleEndRound = useCallback(
    (roundScores: Record<string, number>) => {
      if (!isHost) return

      // Use the socket context to end the round
      endRound(roomCode)
    },
    [endRound, isHost, roomCode],
  )

  const handleNextRound = useCallback(() => {
    if (!isHost) return
    if (round < totalRounds) {
      const randomIndex = Math.floor(Math.random() * marvelSongs.length)
      const song = marvelSongs[randomIndex]
      setCurrentSong(song)
      nextRound(roomCode, song)
    } else {
      // Se for a última ronda, emitir evento para todos
      console.log("[socket] Emitindo show_final_results para sala", roomCode);
      if (socket) {
        socket.emit("show_final_results", { roomCode })
      }
    }
  }, [isHost, nextRound, round, roomCode, totalRounds, socket])

  const handlePlayAgain = useCallback(() => {
    if (!isHost) return
    playAgain(roomCode)
  }, [isHost, playAgain, roomCode])

  // Handler para jogador marcar-se como pronto para jogar de novo
  const handleReadyForNextGame = () => {
    if (socket && currentPlayer) {
      socket.emit("player_ready_for_next_game", { roomCode, playerId: currentPlayer.id })
      setPlayAgainReady((prev) => ({ ...prev, [currentPlayer.id]: true }))
    }
  }

  // Handler para jogador sair
  const handleExit = () => {
    // Aqui podes implementar lógica para remover o jogador da sala ou redirecionar para landing
    setShowLeaderboard(false)
    setGameState("landing")
    setRoomCode("")
    setPlayers([])
    setCurrentPlayer(null)
    setScores({})
    setIsHost(false)
    setRound(1)
  }

  // Host pode iniciar novo jogo
  const handleHostStartAgain = () => {
    if (isHost && socket) {
      playAgain(roomCode)
      setShowLeaderboard(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl comic-bg-light dark:comic-bg-dark min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 
          onClick={() => window.location.reload()}
          className="text-4xl md:text-6xl font-comic transform -rotate-2 text-red-600 dark:text-red-500 drop-shadow-[4px_4px_0px_rgba(0,0,0,0.3)] dark:drop-shadow-[4px_4px_0px_rgba(255,255,255,0.2)] cursor-pointer hover:scale-105 transition-transform"
        >
          <span className="inline-block transform rotate-3 text-blue-600 dark:text-blue-500">Marvel</span>{" "}
          <span className="inline-block transform -rotate-1 text-yellow-500">Music</span>{" "}
          <span className="inline-block transform rotate-2 text-red-600 dark:text-red-500">Quiz!</span>
        </h1>
        <ThemeToggle />
      </div>

      {showDisconnected ? (
        <HostDisconnected />
      ) : (
        <>
          {gameState === "landing" && (
            <ComicPanel className="relative overflow-hidden">
              {joinError && (
                <div className="bg-red-200 text-red-800 border border-red-400 rounded p-2 my-2 text-center font-bold">
                  {joinError}
                </div>
              )}
              <div className="absolute -right-10 -top-10 rotate-12 z-10">
                <ComicText type="pow" size="lg">
                  New!
                </ComicText>
              </div>
              <CardHeader>
                <CardTitle className="text-3xl text-center font-comic transform -rotate-1">Welcome, Marvel Fan!</CardTitle>
                <CardDescription className="text-center text-lg font-comic-sans">
                  <SpeechBubble>Test your knowledge of Marvel movie music!</SpeechBubble>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="create" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="create">Create Room</TabsTrigger>
                    <TabsTrigger value="join">Join Room</TabsTrigger>
                  </TabsList>
                  <TabsContent value="create" className="mt-4">
                    <div className="flex flex-col items-center space-y-4">
                      <p className="text-center">Create a new game room and invite your friends!</p>
                      <div className="w-full">
                        <label className="block text-sm font-medium mb-2">Number of Rounds:</label>
                        <div className="grid grid-cols-5 gap-2">
                          {[5, 10, 15, 20, 30].map((rounds) => (
                            <button
                              key={rounds}
                              onClick={() => setSelectedRounds(rounds)}
                              className={`p-2 text-center rounded-lg border-2 font-comic transition-all transform hover:scale-105 ${
                                selectedRounds === rounds
                                  ? "bg-yellow-400 border-black text-black font-bold scale-105 shadow-[4px_4px_0px_rgba(0,0,0,1)]"
                                  : "bg-white hover:bg-yellow-100 border-black text-black hover:border-yellow-400"
                              }`}
                            >
                              {rounds}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Button
                        onClick={handleCreateRoom}
                        className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-comic text-xl uppercase tracking-wider transform hover:scale-105 transition-transform border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none"
                      >
                        Create Room
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="join" className="mt-4">
                    <div className="flex flex-col space-y-4">
                      <p className="text-center">Enter the 6-digit room code to join a game</p>
                      <Input
                        placeholder="Room Code"
                        value={joinRoomCode}
                        onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        className="text-center text-xl tracking-widest"
                        name="roomCode"
                      />
                      <Button
                        onClick={handleJoinRoom}
                        disabled={joinRoomCode.length !== 6}
                        className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-comic text-xl uppercase tracking-wider transform hover:scale-105 transition-transform border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none"
                      >
                        Join Room
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
              <CardFooter className="flex justify-center">
                <p className="text-sm opacity-70">Assemble your team and test your Marvel music knowledge!</p>
              </CardFooter>
            </ComicPanel>
          )}

          {!joinError && (
            <>
              {gameState === "playerForm" && <PlayerForm roomCode={roomCode} onSubmit={handlePlayerFormSubmit} />}
              {gameState === "lobby" && (
                <RoomLobby roomCode={roomCode} players={players} isHost={isHost} onStartGame={handleStartGame} />
              )}
              {gameState === "game" && (
                <GameScreen
                  players={players}
                  currentPlayer={currentPlayer!}
                  isHost={isHost}
                  round={round}
                  totalRounds={totalRounds}
                  onEndRound={handleEndRound}
                  roomCode={roomCode}
                  currentSong={currentSong}
                  initialIsPlaying={initialIsPlaying}
                  initialMusicPreview={initialMusicPreview}
                  initialTimeLeft={initialTimeLeft}
                />
              )}
              {gameState === "scoreboard" && (
                <Scoreboard
                  players={players}
                  scores={scores}
                  round={round}
                  totalRounds={totalRounds}
                  onNextRound={handleNextRound}
                  isHost={isHost}
                  answer={lastCorrectAnswer}
                />
              )}
              {gameState === "final_results" && (
                <div className="flex flex-col items-center gap-4 w-full">
                  <h2 className="text-2xl font-comic text-center mb-4">🏆 Final Results</h2>
                  <div className="w-full max-w-md bg-white rounded-lg p-6 border-4 border-black">
                    {Object.entries(scores)
                      .sort(([, a], [, b]) => b - a)
                      .map(([playerId, score], index) => {
                        const player = players.find((p) => p.id === playerId);
                        if (!player) return null;

                        // Função para pegar o emoji da posição
                        const getPositionEmoji = (position: number) => {
                          switch (position) {
                            case 0: return "👑"; // 1º lugar - coroa dourada
                            case 1: return "🥈"; // 2º lugar - medalha de prata
                            case 2: return "🥉"; // 3º lugar - medalha de bronze
                            default: return null;
                          }
                        };

                        // Função para pegar a cor de fundo baseada na posição
                        const getBackgroundColor = (position: number) => {
                          switch (position) {
                            case 0: return "bg-gradient-to-r from-yellow-300 to-yellow-100 dark:from-yellow-600 dark:to-yellow-800 border-yellow-500";
                            case 1: return "bg-gradient-to-r from-gray-300 to-gray-100 dark:from-gray-600 dark:to-gray-800 border-gray-500";
                            case 2: return "bg-gradient-to-r from-orange-300 to-orange-100 dark:from-orange-600 dark:to-orange-800 border-orange-500";
                            default: return "bg-white dark:bg-gray-800 border-black dark:border-white";
                          }
                        };

                        return (
                          <div
                            key={player.id}
                            className={`flex items-center justify-between p-4 rounded-lg border-4 mb-3 transform ${index < 3 ? "scale-105" : ""} ${getBackgroundColor(index)}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-black dark:border-white"
                                  style={{ backgroundColor: player.color }}
                                />
                                {index < 3 && (
                                  <div className={`absolute -top-2 -right-2 ${
                                    index === 0 ? "bg-yellow-400" :
                                    index === 1 ? "bg-gray-300" :
                                    "bg-orange-400"
                                  } rounded-full w-6 h-6 flex items-center justify-center border-2 border-black`}>
                                    <span className="text-sm">{getPositionEmoji(index)}</span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="font-medium font-comic-sans">{player.name}</div>
                                {index === 0 && (
                                  <div className="text-xs text-yellow-700 dark:text-yellow-400 font-comic">Champion!</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-2xl font-bold tabular-nums font-comic transform rotate-3">
                                {score} pts
                              </span>
                              {playAgainReady[playerId] && (
                                <span className="text-green-500 text-2xl">✓</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <div className="flex gap-4 mt-4">
                    <Button
                      onClick={handleReadyForNextGame}
                      disabled={!!(currentPlayer && playAgainReady[currentPlayer.id])}
                      className="bg-green-400 hover:bg-green-500 text-black font-comic text-lg border-2 border-black"
                    >
                      Play Again
                    </Button>
                    <Button
                      onClick={handleExit}
                      className="bg-red-400 hover:bg-red-500 text-black font-comic text-lg border-2 border-black"
                    >
                      Exit Game
                    </Button>
                  </div>
                  {isHost && Object.keys(playAgainReady).length > 0 && (
                    <Button
                      onClick={handlePlayAgain}
                      className="mt-4 bg-blue-400 hover:bg-blue-500 text-black font-comic text-lg border-2 border-black"
                    >
                      Start New Game ({Object.values(playAgainReady).filter(Boolean).length} players ready)
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
