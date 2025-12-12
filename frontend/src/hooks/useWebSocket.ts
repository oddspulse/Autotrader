"use client";

import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { WsMessage, WsMessageType, BotState, LogEntry } from "@autotrader/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [botState, setBotState] = useState<BotState | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Create socket connection
    const newSocket = io(API_URL);

    newSocket.on("connect", () => {
      console.log("WebSocket connected");
      setConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("WebSocket disconnected");
      setConnected(false);
    });

    newSocket.on("update", (message: WsMessage) => {
      switch (message.type) {
        case WsMessageType.BOT_STATE:
          setBotState(message.payload);
          break;

        case WsMessageType.LOG:
          setLogs((prev) => [message.payload, ...prev].slice(0, 100));
          break;

        case WsMessageType.TRADE:
        case WsMessageType.POSITION_UPDATE:
        case WsMessageType.ORDER_UPDATE:
          // These update the bot state, which will be reflected in the next BOT_STATE message
          break;
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    socket,
    connected,
    botState,
    logs,
    clearLogs,
  };
}
