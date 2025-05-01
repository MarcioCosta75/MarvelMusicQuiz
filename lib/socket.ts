import { io } from "socket.io-client"

const BACKEND_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001"

export const socket = io(BACKEND_URL, {
  transports: ['polling', 'websocket'], // Start with polling, then upgrade to websocket
  withCredentials: true,
  forceNew: true,
  timeout: 20000,
  // Retry connection
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  // Additional options
  autoConnect: true,
  path: '/socket.io/',
  rejectUnauthorized: false, // Important for SSL/TLS issues
}) 