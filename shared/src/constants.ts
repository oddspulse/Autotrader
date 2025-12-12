/**
 * Hard-coded allowlist of symbols the bot is permitted to trade.
 * NO OTHER SYMBOLS ARE ALLOWED.
 */
export const ALLOWED_SYMBOLS = ["BTC", "ETH", "SOL", "HYPE", "ZEC"] as const;

export type AllowedSymbol = typeof ALLOWED_SYMBOLS[number];

/**
 * Validate if a symbol is in the allowlist
 */
export function isAllowedSymbol(symbol: string): symbol is AllowedSymbol {
  return ALLOWED_SYMBOLS.includes(symbol as AllowedSymbol);
}

/**
 * Exchange venues supported
 */
export enum Exchange {
  DRIFT = "drift",
  JUPITER = "jupiter",
}

/**
 * Trading sides
 */
export enum Side {
  LONG = "LONG",
  SHORT = "SHORT",
}

/**
 * Order types
 */
export enum OrderType {
  MARKET = "MARKET",
  LIMIT = "LIMIT",
  STOP_MARKET = "STOP_MARKET",
  STOP_LIMIT = "STOP_LIMIT",
  TAKE_PROFIT_MARKET = "TAKE_PROFIT_MARKET",
}

/**
 * Order status
 */
export enum OrderStatus {
  PENDING = "PENDING",
  OPEN = "OPEN",
  FILLED = "FILLED",
  PARTIALLY_FILLED = "PARTIALLY_FILLED",
  CANCELLED = "CANCELLED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

/**
 * Position status
 */
export enum PositionStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
}

/**
 * Bot status
 */
export enum BotStatus {
  STOPPED = "STOPPED",
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  ERROR = "ERROR",
  COOLDOWN = "COOLDOWN",
}

/**
 * Trading mode
 */
export enum TradingMode {
  PAPER = "PAPER",
  LIVE = "LIVE",
}

/**
 * Signal type
 */
export enum SignalType {
  LONG = "LONG",
  SHORT = "SHORT",
  CLOSE = "CLOSE",
  NONE = "NONE",
}

/**
 * Timeframe options
 */
export const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h"] as const;
export type Timeframe = typeof TIMEFRAMES[number];

/**
 * Convert timeframe to seconds
 */
export function timeframeToSeconds(tf: Timeframe): number {
  const map: Record<Timeframe, number> = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "4h": 14400,
  };
  return map[tf];
}

/**
 * Risk limits (hard-coded for safety)
 */
export const RISK_LIMITS = {
  MAX_LEVERAGE: 10,
  MIN_ALLOCATION_PCT: 0.01,
  MAX_ALLOCATION_PCT: 0.60, // Fixed at 60%
  MAX_SLIPPAGE_PCT: 0.01, // 1%
  MAX_DAILY_LOSS_PCT: 0.10, // 10%
} as const;
