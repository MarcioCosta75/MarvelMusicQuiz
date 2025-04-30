"use client"

import { Button } from "@/components/ui/button"
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { Player } from "@/lib/types"
import { Shield, Users, Copy, Check } from "lucide-react"
import { useState } from "react"

import { ComicPanel } from "./comic-effects"
import { SpeechBubble } from "./speech-bubble"
import { ComicText } from "./comic-effects"

interface RoomLobbyProps {
  roomCode: string
  players: Player[]
  isHost: boolean
  onStartGame: () => void
}

export default function RoomLobby({ roomCode, players, isHost, onStartGame }: RoomLobbyProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy code:", err)
    }
  }

  return (
    <ComicPanel className="border-red-500 dark:border-red-500">
      <CardHeader>
        <CardTitle className="text-3xl text-center font-comic transform -rotate-1">Game Lobby</CardTitle>
        <CardDescription className="text-center text-lg flex items-center justify-center gap-2">
          Room Code:{" "}
          <div className="flex items-center gap-2">
          <span className="font-mono font-bold tracking-widest bg-black dark:bg-white text-white dark:text-black px-2 py-1 rounded">
            {roomCode}
          </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-2 border-black dark:border-white hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={handleCopyCode}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span className="font-medium">Players ({players.length})</span>
          </div>
          {isHost && (
            <div className="flex items-center gap-1 text-sm bg-yellow-400 text-black px-2 py-1 rounded-full font-comic transform -rotate-2">
              <Shield className="h-4 w-4" />
              <span>Host</span>
            </div>
          )}
        </div>

        <div className="grid gap-2">
          {players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border-2 border-black dark:border-white"
            >
              <div className="w-8 h-8 rounded-full border-2 border-black" style={{ backgroundColor: player.color }} />
              <span className="font-comic-sans font-medium">{player.name}</span>
              {isHost && player.id === players[0].id && (
                <div className="ml-auto flex items-center gap-1 text-xs bg-yellow-400 text-black px-2 py-0.5 rounded-full transform -rotate-2 font-comic">
                  <Shield className="h-3 w-3" />
                  <span>Host</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-4 text-center border-2 border-black dark:border-white">
          <SpeechBubble>
            <p className="text-sm font-comic-sans">
              {isHost
                ? "Waiting for players to join. Share the room code with your friends!"
                : "Waiting for the host to start the game..."}
            </p>
          </SpeechBubble>
        </div>
      </CardContent>
      <CardFooter className="flex justify-center">
        {isHost && (
          <Button
            onClick={onStartGame}
            disabled={players.length < 1}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-comic text-xl uppercase tracking-wider transform hover:scale-105 transition-transform border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none"
          >
            <ComicText type="bam" size="sm" className="py-0 px-2">
              Start Game
            </ComicText>
          </Button>
        )}
      </CardFooter>
    </ComicPanel>
  )
}
