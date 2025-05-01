import { io } from "socket.io-client"

const BACKEND_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001"

export const socket = io(BACKEND_URL) 