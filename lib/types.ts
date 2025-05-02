export type GameState = "landing" | "playerForm" | "lobby" | "game" | "scoreboard" | "gameOver" | "final_results"

export interface Player {
  id: string
  name: string
  color: string
}

export interface MarvelSong {
  id: string
  title: string
  artist: string
  character: string
  movie: string
  audioUrl: string
}
