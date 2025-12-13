import express, { Request, Response } from "express";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import { createServer } from "http";
import { BotConfig, ApiResponse } from "@autotrader/shared";
import { TradingBot } from "../worker/TradingBot";
import { TradingDatabase } from "../database/Database";
import { logger } from "../utils/logger";

/**
 * API server with REST endpoints and WebSocket support
 *
 * Endpoints:
 * - GET /api/status - Get bot status
 * - POST /api/start - Start bot
 * - POST /api/stop - Stop bot
 * - GET /api/markets - Get available markets
 * - GET /api/trades - Get trade history
 * - GET /api/export/trades - Export trades to CSV
 *
 * WebSocket:
 * - Broadcasts bot state updates
 * - Broadcasts log messages
 * - Broadcasts trade updates
 */
export class ApiServer {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;
  private io: SocketIOServer;
  private bot?: TradingBot;
  private database: TradingDatabase;
  private config: BotConfig;

  constructor(config: BotConfig, database: TradingDatabase) {
    this.config = config;
    this.database = database;

    // Express setup
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());

    // HTTP server
    this.httpServer = createServer(this.app);

    // Socket.io
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: config.paperTrading ? "*" : process.env.FRONTEND_URL,
        methods: ["GET", "POST"],
      },
    });

    this.setupRoutes();
    this.setupWebSocket();

    logger.info("API server initialized");
  }

  /**
   * Start the server
   */
  start(port: number, host: string = "0.0.0.0"): void {
    this.httpServer.listen(port, host, () => {
      logger.info(`API server listening on ${host}:${port}`);
    });
  }

  /**
   * Setup REST API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get("/api/health", (req: Request, res: Response) => {
      res.json({ success: true, data: { status: "ok" } });
    });

    // Get bot status
    this.app.get("/api/status", (req: Request, res: Response) => {
      if (!this.bot) {
        res.json({
          success: true,
          data: {
            status: "STOPPED",
            config: this.config,
          },
        });
        return;
      }

      const state = this.bot.getState();
      res.json({ success: true, data: state });
    });

    // Start bot
    this.app.post("/api/start", async (req: Request, res: Response) => {
      try {
        const { walletAddress } = req.body;

        if (!walletAddress) {
          res.status(400).json({
            success: false,
            error: "Wallet address is required",
          });
          return;
        }

        // Create bot if it doesn't exist
        if (!this.bot) {
          this.bot = new TradingBot(this.config, this.database);

          // Set WebSocket callback
          this.bot.setWsCallback((message) => {
            this.io.emit("update", message);
          });

          // Set logger WebSocket callback
          logger.setWsCallback((message) => {
            this.io.emit("update", message);
          });
        }

        await this.bot.start(walletAddress);

        res.json({
          success: true,
          data: { message: "Bot started successfully" },
        });
      } catch (error: any) {
        logger.error("Failed to start bot via API", error);
        res.status(500).json({
          success: false,
          error: error.message || "Failed to start bot",
        });
      }
    });

    // Stop bot
    this.app.post("/api/stop", async (req: Request, res: Response) => {
      try {
        if (!this.bot) {
          res.json({
            success: true,
            data: { message: "Bot is not running" },
          });
          return;
        }

        await this.bot.stop();

        res.json({
          success: true,
          data: { message: "Bot stopped successfully" },
        });
      } catch (error: any) {
        logger.error("Failed to stop bot via API", error);
        res.status(500).json({
          success: false,
          error: error.message || "Failed to stop bot",
        });
      }
    });

    // Get available markets
    this.app.get("/api/markets", async (req: Request, res: Response) => {
      try {
        // Return hardcoded markets (would query exchange in production)
        const markets = [
          { symbol: "BTC", available: true },
          { symbol: "ETH", available: true },
          { symbol: "SOL", available: true },
          { symbol: "HYPE", available: false, reason: "Not supported on Drift" },
          { symbol: "ZEC", available: false, reason: "Not supported on Drift" },
        ];

        res.json({ success: true, data: markets });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get trade history
    this.app.get("/api/trades", (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const trades = this.database.getTrades(limit);

        res.json({ success: true, data: trades });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get position history
    this.app.get("/api/positions", (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const positions = this.database.getPositions(limit);

        res.json({ success: true, data: positions });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get equity snapshots
    this.app.get("/api/equity", (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 1000;
        const snapshots = this.database.getEquitySnapshots(limit);

        res.json({ success: true, data: snapshots });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get logs
    this.app.get("/api/logs", (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 1000;
        const logs = this.database.getLogs(limit);

        res.json({ success: true, data: logs });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Export trades to CSV
    this.app.get("/api/export/trades", (req: Request, res: Response) => {
      try {
        const csv = this.database.exportTradesToCSV();

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=trades.csv");
        res.send(csv);
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Update config
    this.app.post("/api/config", (req: Request, res: Response) => {
      try {
        const updates = req.body;

        // Validate and update config
        if (updates.activeSymbol) {
          this.config.activeSymbol = updates.activeSymbol;
        }

        if (updates.paperTrading !== undefined) {
          this.config.paperTrading = updates.paperTrading;
        }

        res.json({
          success: true,
          data: { message: "Config updated", config: this.config },
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });
  }

  /**
   * Setup WebSocket
   */
  private setupWebSocket(): void {
    this.io.on("connection", (socket) => {
      logger.info(`WebSocket client connected: ${socket.id}`);

      // Send initial state
      if (this.bot) {
        socket.emit("update", {
          type: "BOT_STATE",
          payload: this.bot.getState(),
          timestamp: Date.now(),
        });
      }

      socket.on("disconnect", () => {
        logger.info(`WebSocket client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Auto-start bot (for deployment auto-start)
   */
  async autoStartBot(walletAddress: string): Promise<void> {
    try {
      logger.info(`Auto-starting bot with wallet: ${walletAddress}`);

      // Create bot if it doesn't exist
      if (!this.bot) {
        this.bot = new TradingBot(this.config, this.database);

        // Set WebSocket callback
        this.bot.setWsCallback((message) => {
          this.io.emit("update", message);
        });

        // Set logger WebSocket callback
        logger.setWsCallback((message) => {
          this.io.emit("update", message);
        });
      }

      await this.bot.start(walletAddress);
      logger.info("Bot auto-started successfully");
    } catch (error) {
      logger.error("Failed to auto-start bot", error);
      throw error;
    }
  }

  /**
   * Stop the server and bot
   */
  async stop(): Promise<void> {
    try {
      if (this.bot) {
        await this.bot.stop();
      }
      this.httpServer.close();
      this.io.close();
      logger.info("API server stopped");
    } catch (error) {
      logger.error("Error stopping server", error);
    }
  }
}
