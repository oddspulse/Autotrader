import dotenv from "dotenv";
import path from "path";
import { BotConfig, Exchange, isAllowedSymbol, ALLOWED_SYMBOLS } from "@autotrader/shared";
import { ApiServer } from "./server/ApiServer";
import { TradingDatabase } from "./database/Database";
import { logger } from "./utils/logger";

// Load environment variables
dotenv.config();

/**
 * Load configuration from environment variables
 */
function loadConfig(): BotConfig {
  // Validate required env vars
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) {
    throw new Error("SOLANA_RPC_URL environment variable is required");
  }

  // Parse symbols
  const symbolsStr = process.env.SYMBOLS || "BTC,ETH,SOL,HYPE,ZEC";
  const symbols = symbolsStr.split(",").map((s) => s.trim());

  // Validate all symbols are in allowlist
  for (const symbol of symbols) {
    if (!isAllowedSymbol(symbol)) {
      throw new Error(
        `Symbol "${symbol}" is not in the allowlist. Allowed symbols: ${ALLOWED_SYMBOLS.join(", ")}`
      );
    }
  }

  // Validate active symbol
  const activeSymbol = process.env.ACTIVE_SYMBOL || "SOL";
  if (!isAllowedSymbol(activeSymbol)) {
    throw new Error(
      `Active symbol "${activeSymbol}" is not in the allowlist. Allowed symbols: ${ALLOWED_SYMBOLS.join(", ")}`
    );
  }

  const config: BotConfig = {
    rpcUrl,
    network: process.env.SOLANA_NETWORK || "mainnet-beta",
    exchange: (process.env.EXCHANGE as Exchange) || Exchange.DRIFT,
    symbols: symbols as any,
    activeSymbol: activeSymbol as any,
    allocationPct: parseFloat(process.env.ALLOCATION_PCT || "0.60"),
    maxLeverage: parseInt(process.env.MAX_LEVERAGE || "10"),
    takeProfitPct: parseFloat(process.env.TAKE_PROFIT_PCT || "0.20"),
    stopLossPct: parseFloat(process.env.STOP_LOSS_PCT || "0.05"),
    timeframe: (process.env.TIMEFRAME as any) || "5m",
    signalStrategy: process.env.SIGNAL_STRATEGY || "ema_crossover",
    emaFast: parseInt(process.env.EMA_FAST || "9"),
    emaSlow: parseInt(process.env.EMA_SLOW || "21"),
    dailyLossCapPct: parseFloat(process.env.DAILY_LOSS_CAP_PCT || "0.03"),
    maxConsecutiveLosses: parseInt(process.env.MAX_CONSECUTIVE_LOSSES || "3"),
    consecutiveLossCooldownHours: parseInt(process.env.CONSECUTIVE_LOSS_COOLDOWN_HOURS || "6"),
    maxSlippagePct: parseFloat(process.env.MAX_SLIPPAGE_PCT || "0.003"),
    orderTimeoutSeconds: parseInt(process.env.ORDER_TIMEOUT_SECONDS || "30"),
    maxRetries: parseInt(process.env.MAX_RETRIES || "3"),
    paperTrading: process.env.PAPER_TRADING === "true",
  };

  // Validate config
  if (config.maxLeverage > 10) {
    throw new Error("Max leverage cannot exceed 10x");
  }

  if (config.allocationPct > 0.60) {
    logger.warn("Allocation percentage exceeds 60% - capping at 60%");
    config.allocationPct = 0.60;
  }

  return config;
}

/**
 * Main entry point
 */
async function main() {
  try {
    logger.info("Starting Solana Perpetuals Auto-Trader...");

    // Display warning
    logger.warn("⚠️  LEVERAGED TRADING IS EXTREMELY RISKY ⚠️");
    logger.warn("Only trade with funds you can afford to lose.");
    logger.warn("This bot executes real trades with real money.");

    // Load config
    const config = loadConfig();

    logger.info("Configuration loaded", {
      exchange: config.exchange,
      activeSymbol: config.activeSymbol,
      leverage: config.maxLeverage,
      paperTrading: config.paperTrading,
      mode: config.paperTrading ? "PAPER TRADING" : "LIVE TRADING",
    });

    // Initialize database
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "../data/trades.db");
    const database = new TradingDatabase(dbPath);

    // Create API server
    const server = new ApiServer(config, database);

    // Start server
    const port = parseInt(process.env.PORT || "3001");
    server.start(port);

    logger.info("Auto-trader backend ready");
    logger.info(`API server: http://localhost:${port}`);
    logger.info("Connect your Phantom wallet in the frontend to start trading");

    // Graceful shutdown
    process.on("SIGINT", async () => {
      logger.info("Shutting down gracefully...");
      database.close();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      logger.info("Shutting down gracefully...");
      database.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error("Fatal error during startup", error);
    process.exit(1);
  }
}

// Run
main();
