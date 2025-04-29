import { Server } from 'socket.io'
import { NextResponse } from 'next/server'
import type { NextApiResponseServerIO } from '@/types/next'

const ioHandler = (req: Request, res: NextApiResponseServerIO) => {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
    })

    io.on('connection', (socket) => {
      socket.on('join-room', (roomId: string) => {
        socket.join(roomId)
      })

      socket.on('leave-room', (roomId: string) => {
        socket.leave(roomId)
      })

      socket.on('game-state', (gameState: any, roomId: string) => {
        io.to(roomId).emit('game-state-update', gameState)
      })
    })

    res.socket.server.io = io
  }

  return NextResponse.json({ success: true })
}

export const GET = ioHandler
export const POST = ioHandler 