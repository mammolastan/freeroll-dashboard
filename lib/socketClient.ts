// lib/socketClient.ts

"use client";
import { io } from "socket.io-client";

// Use current domain in production, localhost in development
const getSocketUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use current domain and port
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port || (protocol === 'https:' ? '443' : '80');

    // In production, the Socket.IO server runs on the same port as the web server
    return `${protocol}//${hostname}:${port}`;
  }

  // Server-side fallback (shouldn't be used for Socket.IO client)
  return "http://localhost:3000";
};

export const socket = io(getSocketUrl(), {
  reconnection: true,
  reconnectionAttempts: Infinity, // Keep trying forever
  reconnectionDelay: 1000, // Start with 1 second
  reconnectionDelayMax: 10000, // Max 10 seconds between attempts
  timeout: 20000, // Connection timeout
});
