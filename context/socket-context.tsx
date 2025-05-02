"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { io, type Socket } from "socket.io-client"
import type { Player, MarvelSong } from "@/lib/types"

// Define the shape of our context
interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  createRoom: (options: { totalRounds: number }) => Promise<{ success: boolean; roomCode: string; totalRounds: number }>
  joinRoom: (roomCode: string) => Promise<{ success: boolean; error?: string; isHost: boolean }>
  addPlayer: (roomCode: string, player: Player) => void
  startGame: (roomCode: string, song: MarvelSong) => void
  toggleMusic: (roomCode: string, isPlaying: boolean) => void
  submitGuess: (roomCode: string, playerId: string, guess: string) => void
  endRound: (roomCode: string) => void
  nextRound: (roomCode: string, song: MarvelSong) => void
  playAgain: (roomCode: string) => void
}

// Create the context
const SocketContext = createContext<SocketContextType | undefined>(undefined)

// Socket.io server URL
const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"

export interface JoinRoomResponse {
  success: boolean;
  error?: string;
  isHost: boolean;
  isPlaying?: boolean;
  musicPreview?: string | null;
  timeLeft?: number;
  currentSong?: any;
  totalRounds?: number;
}

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io(SOCKET_SERVER_URL)

    // Set up event listeners
    socketInstance.on("connect", () => {
      console.log("Connected to socket server")
      setIsConnected(true)
    })

    socketInstance.on("disconnect", () => {
      console.log("Disconnected from socket server")
      setIsConnected(false)
    })

    // Save socket instance
    setSocket(socketInstance)

    // Clean up on unmount
    return () => {
      socketInstance.disconnect()
    }
  }, [])

  // Create a new room
  const createRoom = useCallback(async ({ totalRounds }: { totalRounds: number }): Promise<{ success: boolean; roomCode: string; totalRounds: number }> => {
    return new Promise((resolve) => {
      if (!socket) {
        resolve({ success: false, roomCode: "", totalRounds: 0 })
        return
      }

      socket.emit("create_room", { totalRounds }, (response: { success: boolean; roomCode: string; totalRounds: number }) => {
        resolve(response)
      })
    })
  }, [socket])

  // Join an existing room
  const joinRoom = (roomCode: string): Promise<JoinRoomResponse> => {
    return new Promise((resolve) => {
      if (!socket) {
        resolve({ success: false, error: "Socket not connected", isHost: false })
        return
      }

      socket.emit("join_room", { roomCode }, (response: JoinRoomResponse) => {
        console.log("Join room response:", response)
        resolve(response)
      })
    })
  }

  // Add player to room
  const addPlayer = (roomCode: string, player: Player) => {
    if (!socket) return
    socket.emit("add_player", { roomCode, player })
  }

  // Start game
  const startGame = (roomCode: string, song: MarvelSong) => {
    if (!socket) return
    socket.emit("start_game", { roomCode, song })
  }

  // Toggle music play state
  const toggleMusic = (roomCode: string, isPlaying: boolean) => {
    if (!socket) return
    socket.emit("toggle_music", { roomCode, isPlaying })
  }

  // Submit guess
  const submitGuess = (roomCode: string, playerId: string, guess: string) => {
    if (!socket) return
    socket.emit("submit_guess", { roomCode, playerId, guess })
  }

  // End round
  const endRound = (roomCode: string) => {
    if (!socket) return
    socket.emit("end_round", { roomCode })
  }

  // Next round
  const nextRound = (roomCode: string, song: MarvelSong) => {
    if (!socket) return
    socket.emit("next_round", { roomCode, song })
  }

  // Play again
  const playAgain = (roomCode: string) => {
    if (!socket) return
    socket.emit("play_again", { roomCode })
  }

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        createRoom,
        joinRoom,
        addPlayer,
        startGame,
        toggleMusic,
        submitGuess,
        endRound,
        nextRound,
        playAgain,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

// Custom hook to use the socket context
export const useSocket = () => {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider")
  }
  return context
}
