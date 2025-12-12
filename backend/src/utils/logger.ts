import pino from "pino";
import { WsMessageType } from "@autotrader/shared";

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});

/**
 * Enhanced logger with WebSocket broadcasting support
 */
class Logger {
  private wsCallback?: (message: any) => void;

  setWsCallback(callback: (message: any) => void): void {
    this.wsCallback = callback;
  }

  debug(message: string, data?: any): void {
    pinoLogger.debug({ data }, message);
  }

  info(message: string, data?: any): void {
    pinoLogger.info({ data }, message);
    this.broadcast("info", message, data);
  }

  warn(message: string, data?: any): void {
    pinoLogger.warn({ data }, message);
    this.broadcast("warn", message, data);
  }

  error(message: string, error?: any): void {
    pinoLogger.error({ error }, message);
    this.broadcast("error", message, error);
  }

  private broadcast(level: string, message: string, data?: any): void {
    if (this.wsCallback) {
      this.wsCallback({
        type: WsMessageType.LOG,
        payload: {
          timestamp: Date.now(),
          level,
          message,
          data,
        },
        timestamp: Date.now(),
      });
    }
  }
}

export const logger = new Logger();
