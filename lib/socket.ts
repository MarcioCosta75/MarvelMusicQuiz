import { io } from "socket.io-client"

const SOCKET_URL = process.env.NODE_ENV === "production" 
  ? "https://marvelmusicquiz-production.up.railway.app"
  : "http://localhost:3001"

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ['polling', 'websocket'],
  withCredentials: true,
  forceNew: true,
  path: '/socket.io',
})

let reconnectAttempts = 0;

socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error);
  // Implement exponential backoff
  reconnectAttempts++;
  const retryDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
  setTimeout(() => {
    socket.connect();
  }, retryDelay);
});

socket.on("connect", () => {
  console.log("Socket connected successfully");
  reconnectAttempts = 0;
});

socket.on("disconnect", (reason) => {
  console.log("Socket disconnected:", reason)
  if (reason === "io server disconnect") {
    // Disconnected by the server, reconnect manually
    socket.connect()
  }
})

export default socket 