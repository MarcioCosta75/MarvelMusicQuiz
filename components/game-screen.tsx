"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Player } from "@/lib/types"
import type { MarvelSong } from "@/lib/types"
import { marvelSongs } from "@/lib/marvel-songs"
import { Play, Pause } from "lucide-react"
import { useSocket } from "@/context/socket-context"
import { ComicPanel } from "./comic-effects"
import { SpeechBubble } from "./speech-bubble"
import { ComicText } from "./comic-effects"
import { Socket } from "socket.io-client"

interface GameScreenProps {
  players: Player[]
  currentPlayer: Player
  isHost: boolean
  round: number
  totalRounds: number
  onEndRound: (scores: Record<string, number>) => void
  roomCode: string
  currentSong: MarvelSong | null
  initialIsPlaying?: boolean
  initialMusicPreview?: string | null
  initialTimeLeft?: number
}

// Custom hook for managing audio playback
function useAudioPlayer(musicPreview: string | null, isPlaying: boolean, isHost: boolean, socket: Socket | null, roomCode: string, currentSong: MarvelSong | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Cleanup function to properly dispose of audio instance
  const cleanup = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Cleanup previous audio instance
    cleanup();

    const setupAudio = async () => {
      if (!musicPreview || !isPlaying) return;

      try {
        // Create new audio instance
        const audio = new window.Audio();
        audioRef.current = audio;

        // Set up event listeners
        const onCanPlayThrough = async () => {
          try {
            if (isPlaying && audioRef.current === audio) {
              await audio.play();
            }
          } catch (playError) {
            console.warn("Error playing audio after load:", playError);
          }
        };

        const onError = (e: Event) => {
          console.error("Audio error:", e);
          if (isHost && socket && audioRef.current === audio) {
            // If host, try another song
            const availableSongs = marvelSongs.filter(s => s.id !== currentSong?.id);
            const nextSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];
            socket.emit("current_song", { roomCode, currentSong: nextSong });
          }
        };

        // Add event listeners
        audio.addEventListener('canplaythrough', onCanPlayThrough);
        audio.addEventListener('error', onError);

        // Store cleanup function
        cleanupRef.current = () => {
          audio.removeEventListener('canplaythrough', onCanPlayThrough);
          audio.removeEventListener('error', onError);
          audio.pause();
          audio.src = '';
        };

        // Set source and load
        audio.src = musicPreview;
        audio.load();

      } catch (e) {
        console.error("Error setting up audio:", e);
        cleanup();
      }
    };

    setupAudio();

    // Cleanup on unmount or when dependencies change
    return cleanup;
  }, [musicPreview, isHost, socket, roomCode, currentSong, cleanup]);

  // Handle play/pause state changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlayPause = async () => {
      try {
        if (isPlaying) {
          await audio.play();
        } else {
          audio.pause();
        }
      } catch (e) {
        console.warn("Error handling play/pause:", e);
      }
    };

    handlePlayPause();
  }, [isPlaying]);

  return audioRef;
}

export default function GameScreen({
  players,
  currentPlayer,
  isHost,
  round,
  totalRounds,
  onEndRound,
  roomCode,
  currentSong,
  initialIsPlaying = false,
  initialMusicPreview = null,
  initialTimeLeft = 30,
}: GameScreenProps) {
  const [timeLeft, setTimeLeft] = useState(() => initialTimeLeft)
  const [isPlaying, setIsPlaying] = useState(() => initialIsPlaying)
  const [guess, setGuess] = useState("")
  const [playerGuesses, setPlayerGuesses] = useState<Record<string, string>>({})
  const [correctGuesses, setCorrectGuesses] = useState<Record<string, boolean>>({})
  const [roundScores, setRoundScores] = useState<Record<string, number>>({})
  const [musicPreview, setMusicPreview] = useState<string | null>(() => initialMusicPreview)
  const [musicInfo, setMusicInfo] = useState<{ uri: string, title: string, artist: string, coverart: string } | null>(null)
  const [loadingMusic, setLoadingMusic] = useState(false)
  const [showCorrectAnswer, setShowCorrectAnswer] = useState<string | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState<string | null>(null)

  const { socket, toggleMusic, submitGuess } = useSocket()

  // Use the custom audio hook
  const audioRef = useAudioPlayer(musicPreview, isPlaying, isHost, socket, roomCode, currentSong)

  // Initialize audio
  useEffect(() => {
    if (isHost && !audioRef.current) {
      audioRef.current = new Audio(currentSong?.audioUrl || "")
      audioRef.current.volume = 0.5
      audioRef.current.addEventListener("ended", () => {
        setIsPlaying(false)
        toggleMusic(roomCode, false)
      })
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.removeEventListener("ended", () => {
          setIsPlaying(false)
        })
      }
    }
  }, [isHost, currentSong?.audioUrl, roomCode, toggleMusic])

  // Buscar preview do Shazam usando o título da música recebida do backend
  useEffect(() => {
    if (!socket) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 5;
    // Handler para evento current_song
    const handleCurrentSong = (data: { currentSong: MarvelSong }) => {
      if (!data.currentSong) return;
      setMusicPreview(null);
      setMusicInfo(null);
      setLoadingMusic(true);
      // Buscar preview no Shazam usando o título da música recebida do backend
      async function fetchMusic(songToTry: MarvelSong) {
        try {
          const q = songToTry.title;
          const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
          const shazamRes = await fetch(`${baseUrl}/shazam/preview?q=${encodeURIComponent(q)}`);
          if (shazamRes.ok) {
            const dataShazam = await shazamRes.json();
            // Só aceitar se o título do Shazam for igual ao do MarvelSong
            if (
              !cancelled &&
              dataShazam.uri &&
              typeof dataShazam.uri === 'string' &&
              dataShazam.uri.startsWith('http') &&
              dataShazam.title &&
              dataShazam.title.toLowerCase().trim() === songToTry.title.toLowerCase().trim()
            ) {
              setMusicPreview(dataShazam.uri);
              setMusicInfo(dataShazam);
              // Emitir preview para todos se for host
              if (isHost && socket) {
                socket.emit("music_preview", { roomCode, musicPreview: dataShazam.uri });
                socket.emit("music_info", { roomCode, musicInfo: dataShazam });
                socket.emit("toggle_music", { roomCode, isPlaying: true });
              }
              setLoadingMusic(false);
              return;
            }
          }
          // Se não encontrou preview válido, não toca nada
          setMusicPreview(null);
          setMusicInfo(null);
          setLoadingMusic(false);
        } catch (e) {
          if (!cancelled) {
            setMusicPreview(null);
            setMusicInfo(null);
            setLoadingMusic(false);
          }
        }
      }
      fetchMusic(data.currentSong);
    };
    socket.on("current_song", handleCurrentSong);
    return () => {
      cancelled = true;
      socket.off("current_song", handleCurrentSong);
    };
  }, [socket, isHost, roomCode]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return

    // Listen for music toggle events
    socket.on("music_toggled", ({ isPlaying: newIsPlaying }) => {
      console.log("[socket] music_toggled recebido:", newIsPlaying)
      setIsPlaying(newIsPlaying)
      // If host, control the audio
      if (isHost && audioRef.current) {
        if (newIsPlaying) {
          audioRef.current.play()
        } else {
          audioRef.current.pause()
        }
      }
    })

    // Listen for preview sync
    socket.on("music_preview", ({ musicPreview }) => {
      console.log("[socket] music_preview recebido:", musicPreview)
      setMusicPreview(musicPreview)
    })

    // Listen for guess submissions
    socket.on("guess_submitted", ({ playerGuesses: newPlayerGuesses, correctGuesses: newCorrectGuesses }) => {
      setPlayerGuesses(newPlayerGuesses)
      setCorrectGuesses(newCorrectGuesses)
    })

    // Listen for timer updates
    socket.on("timer_updated", ({ timeLeft: newTimeLeft, isPlaying: newIsPlaying, roundScores: newRoundScores }) => {
      setTimeLeft(newTimeLeft)
      setIsPlaying(newIsPlaying)
      if (Object.keys(newRoundScores).length > 0) {
        setRoundScores(newRoundScores)
        // End round after 3 seconds to show results
        if (isHost && newTimeLeft === 0) {
          setTimeout(() => {
            onEndRound(newRoundScores)
          }, 3000)
        }
      }
    })

    // Listen for all_failed (todos falharam a ronda)
    socket.on("all_failed", ({ correctAnswer }) => {
      setShowCorrectAnswer(correctAnswer)
      // Após 3 segundos, limpar e avançar para o scoreboard
      setTimeout(() => {
        setShowCorrectAnswer(null)
      }, 3000)
    })

    return () => {
      // Clean up event listeners
      socket.off("music_toggled")
      socket.off("music_preview")
      socket.off("guess_submitted")
      socket.off("timer_updated")
      socket.off("all_failed")
    }
  }, [socket, isHost, onEndRound])

  // Receber info da música de todos
  useEffect(() => {
    if (!socket) return;
    const handleMusicInfo = (data: { musicInfo: { uri: string, title: string, artist: string, coverart: string } }) => setMusicInfo(data.musicInfo);
    socket.on("music_info", handleMusicInfo);
    return () => { socket.off("music_info", handleMusicInfo); };
  }, [socket]);

  const handleTogglePlayPause = () => {
    const newIsPlaying = !isPlaying
    toggleMusic(roomCode, newIsPlaying)
  }

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!guess.trim() || playerGuesses[currentPlayer.id]) return

    // Submit guess via socket
    submitGuess(roomCode, currentPlayer.id, guess)

    // Clear input
    setGuess("")
  }

  // Calculate progress percentage
  const [progressPercentage, setProgressPercentage] = useState(100)
  useEffect(() => {
    setProgressPercentage(((totalRounds - round + 1) / totalRounds) * 100)
  }, [round, totalRounds])

  return (
    <div className="space-y-6">
      <ComicPanel className="border-red-500 dark:border-red-500">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-comic transform -rotate-1">
              Round {round}/{totalRounds}
            </CardTitle>
            <div className="text-3xl font-comic bg-black dark:bg-white text-white dark:text-black py-1 px-3 rounded-lg transform rotate-2 border-2 border-black dark:border-white">
              {timeLeft}
            </div>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-red-600 to-yellow-500 h-2.5 rounded-full transition-all duration-1000"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {showCorrectAnswer ? (
            <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg text-center border-2 border-yellow-500">
              <SpeechBubble type="shout">
                <p className="text-xl font-bold font-comic-sans text-red-700 dark:text-yellow-300">Nobody got it right!</p>
                <p className="text-lg font-comic-sans mt-2">Correct answer:</p>
                <p className="text-2xl font-comic text-blue-700 dark:text-yellow-200">{showCorrectAnswer}</p>
              </SpeechBubble>
            </div>
          ) : musicInfo ? (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg space-y-4 border-2 border-black dark:border-white">
              <div className="flex items-center gap-4">
                {musicInfo.coverart && (
                  <img src={musicInfo.coverart} alt="Cover Art" className="w-20 h-20 rounded shadow border-2 border-black" />
                )}
                <div>
                  <h3 className="font-comic text-lg">{musicInfo.title}</h3>
                  <p className="text-sm opacity-80 font-comic-sans">{musicInfo.artist}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg text-center border-2 border-black dark:border-white">
              <SpeechBubble>
                <p className="text-lg font-medium font-comic-sans">Listen carefully!</p>
                <p className="text-sm opacity-70 font-comic-sans">
                  {isPlaying
                    ? "Music is playing... Guess the Marvel character!"
                    : "Waiting for the host to play the music..."}
                </p>
              </SpeechBubble>
            </div>
          )}

          <form onSubmit={handleGuessSubmit} className="space-y-2">
            <Input
              placeholder="Type your guess here..."
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              disabled={!!playerGuesses[currentPlayer.id] || !isPlaying || !musicPreview}
              className="text-lg"
            />
            <Button
              type="submit"
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-comic text-xl uppercase tracking-wider transform hover:scale-105 transition-transform border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none"
              disabled={!guess.trim() || !!playerGuesses[currentPlayer.id] || !isPlaying || !musicPreview}
            >
              Submit Guess
            </Button>
          </form>

          <div className="space-y-2">
            <h3 className="font-medium">Player Guesses:</h3>
            <div className="grid gap-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 ${
                    playerGuesses[player.id]
                      ? correctGuesses[player.id]
                        ? "bg-green-100 dark:bg-green-900/30 border-green-500"
                        : "bg-red-100 dark:bg-red-900/30 border-red-500"
                      : "bg-white dark:bg-gray-800 border-black dark:border-white"
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-full border-2 border-black dark:border-white"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="font-medium font-comic-sans">{player.name}</span>
                  {playerGuesses[player.id] ? (
                    <div className="ml-auto flex items-center gap-2">
                      {correctGuesses[player.id] ? (
                        <ComicText type="bam" size="sm" className="py-0 px-2">
                          Correct!
                        </ComicText>
                      ) : (
                        <ComicText type="wham" size="sm" className="py-0 px-2">
                          Wrong!
                        </ComicText>
                      )}
                      {timeLeft === 0 && roundScores[player.id] > 0 && (
                        <span className="font-bold font-comic">+{roundScores[player.id]}</span>
                      )}
                    </div>
                  ) : (
                    <span className="ml-auto text-sm opacity-60 font-comic-sans">
                      {isPlaying ? "Thinking..." : "Waiting..."}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {musicPreview && typeof musicPreview === 'string' && musicPreview.trim() !== '' ? (
            <div className="flex justify-center my-4">
              <audio controls src={musicPreview} className="w-full max-w-md" autoPlay />
            </div>
          ) : (
            <div className="flex justify-center my-4 text-sm opacity-60">No preview available for this song. The host can skip this round.</div>
          )}
        </CardContent>
      </ComicPanel>
    </div>
  )
}
