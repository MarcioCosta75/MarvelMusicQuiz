"use client"

import { Button } from "@/components/ui/button"
import { CardHeader, CardDescription, CardTitle, CardFooter } from "@/components/ui/card"
import type { Player } from "@/lib/types"
import { Trophy } from "lucide-react"
import { motion } from "framer-motion"

// 1. Import our comic components:
import { ComicPanel } from "./comic-effects"
import { ComicText } from "./comic-effects"

interface ScoreboardProps {
  players: Player[]
  scores: Record<string, number>
  round: number
  totalRounds: number
  onNextRound: () => void
  isHost: boolean
  answer: string
}

export default function Scoreboard({ players, scores, round, totalRounds, onNextRound, isHost, answer }: ScoreboardProps) {
  // Sort players by score
  const sortedPlayers = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))

  // 2. Replace Card with ComicPanel:
  return (
    <ComicPanel className="border-red-500 dark:border-red-500">
      <CardHeader>
        <CardTitle className="text-3xl text-center font-comic transform -rotate-1">
          {round < totalRounds ? `Round ${round} Results` : "Final Results"}
        </CardTitle>
        <CardDescription className="text-center text-lg font-comic-sans">
          {round < totalRounds ? "Get ready for the next round!" : "Final scores"}
          <div className="mt-2 text-base font-bold text-red-600 dark:text-yellow-400">
            Correct answer: {answer}
          </div>
        </CardDescription>
      </CardHeader>
      <div className="space-y-6 p-4">
        <div className="grid gap-3">
          {sortedPlayers.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={`flex items-center justify-between p-4 rounded-lg border-4 ${
                index === 0
                  ? "bg-gradient-to-r from-yellow-300 to-yellow-100 dark:from-yellow-600 dark:to-yellow-800 border-yellow-500 transform -rotate-1"
                  : "bg-white dark:bg-gray-800 border-black dark:border-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-black dark:border-white"
                    style={{ backgroundColor: player.color }}
                  />
                  {index === 0 && (
                    <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full w-6 h-6 flex items-center justify-center border-2 border-black">
                      <Trophy className="h-3 w-3 text-black" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium font-comic-sans">{player.name}</div>
                  {index === 0 && (
                    <div className="text-xs text-yellow-700 dark:text-yellow-400 font-comic">In the lead!</div>
                  )}
                </div>
              </div>
              <div className="text-2xl font-bold tabular-nums font-comic transform rotate-3">
                {scores[player.id] || 0}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <CardFooter className="flex justify-center">
        {isHost && round < totalRounds && (
          <Button
            onClick={onNextRound}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-comic text-xl uppercase tracking-wider transform hover:scale-105 transition-transform border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none"
          >
            <ComicText type="boom" size="sm" className="py-0 px-2">
              Next Round
            </ComicText>
          </Button>
        )}
        {isHost && round >= totalRounds && (
          <Button
            onClick={onNextRound}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-comic text-xl uppercase tracking-wider transform hover:scale-105 transition-transform border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none"
          >
            <ComicText type="boom" size="sm" className="py-0 px-2">
              See Final Results
            </ComicText>
          </Button>
        )}
      </CardFooter>
    </ComicPanel>
  )
}
