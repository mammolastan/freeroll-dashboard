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

export const socket = io(getSocketUrl());
