"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CardHeader, CardDescription, CardFooter, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import type { Player } from "@/lib/types"
import { generateId } from "@/lib/utils"
import { ComicPanel } from "./comic-effects"
import { Copy, Check } from "lucide-react"

const PLAYER_COLORS = [
  "#e53e3e", // Red
  "#dd6b20", // Orange
  "#d69e2e", // Yellow
  "#38a169", // Green
  "#3182ce", // Blue
  "#805ad5", // Purple
  "#d53f8c", // Pink
  "#718096", // Gray
]

interface PlayerFormProps {
  roomCode: string
  onSubmit: (player: Player) => void
}

export default function PlayerForm({ roomCode, onSubmit }: PlayerFormProps) {
  const [name, setName] = useState("")
  const [selectedColor, setSelectedColor] = useState(PLAYER_COLORS[0])
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      const player: Player = {
        id: generateId(),
        name: name.trim(),
        color: selectedColor,
      }
      onSubmit(player)
    }
  }

  return (
    <ComicPanel className="border-red-500 dark:border-red-500">
      <CardHeader>
        <CardTitle className="text-3xl text-center font-comic transform -rotate-1">Join the Game</CardTitle>
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

      <form onSubmit={handleSubmit} className="space-y-6 p-4">
        <div className="space-y-2">
          <Label htmlFor="name">Your Superhero Name</Label>
          <Input
            id="name"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={15}
            className="text-lg"
          />
        </div>

        <div className="space-y-2">
          <Label>Choose Your Color</Label>
          <div className="grid grid-cols-4 gap-2">
            {PLAYER_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-16 h-16 rounded-full transition-all border-4 border-black hover:scale-110 transform ${
                  selectedColor === color ? "ring-4 ring-offset-2 ring-offset-background ring-primary scale-110" : ""
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
        </div>
      </form>

      <CardFooter>
        <Button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-comic text-xl uppercase tracking-wider transform hover:scale-105 transition-transform border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none"
        >
          Join Game
        </Button>
      </CardFooter>
    </ComicPanel>
  )
}
