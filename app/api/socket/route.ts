import { Server } from 'socket.io'
import { NextResponse } from 'next/server'
import type { NextApiResponseServerIO } from '@/types/next'

const ioHandler = (req: Request, res: NextApiResponseServerIO) => {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling'],
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true,
      }
    })

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      socket.on('join-room', (roomId: string) => {
        socket.join(roomId)
        console.log(`User ${socket.id} joined room ${roomId}`)
      })

      socket.on('leave-room', (roomId: string) => {
        socket.leave(roomId)
        console.log(`User ${socket.id} left room ${roomId}`)
      })

      socket.on('game-state', (gameState: any, roomId: string) => {
        io.to(roomId).emit('game-state-update', gameState)
        console.log(`Game state updated in room ${roomId}`)
      })

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
      })
    })

    res.socket.server.io = io
  }

  return NextResponse.json({ success: true })
}

export const GET = ioHandler
export const POST = ioHandler 