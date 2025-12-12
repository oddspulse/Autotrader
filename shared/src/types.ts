import {
  AllowedSymbol,
  Exchange,
  Side,
  OrderType,
  OrderStatus,
  PositionStatus,
  BotStatus,
  TradingMode,
  SignalType,
  Timeframe,
} from "./constants";

/**
 * Configuration for the trading bot
 */
export interface BotConfig {
  // Network
  rpcUrl: string;
  network: string;

  // Exchange
  exchange: Exchange;

  // Markets
  symbols: AllowedSymbol[];
  activeSymbol: AllowedSymbol;

  // Position sizing
  allocationPct: number; // 0.60 = 60%
  maxLeverage: number; // <= 10

  // Strategy
  takeProfitPct: number; // 0.20 = 20%
  stopLossPct: number; // 0.05 = 5%
  timeframe: Timeframe;
  signalStrategy: string;

  // Signal params
  emaFast: number;
  emaSlow: number;

  // Risk management
  dailyLossCapPct: number;
  maxConsecutiveLosses: number;
  consecutiveLossCooldownHours: number;
  maxSlippagePct: number;

  // Order management
  orderTimeoutSeconds: number;
  maxRetries: number;

  // Mode
  paperTrading: boolean;
}

/**
 * Market information
 */
export interface MarketInfo {
  symbol: AllowedSymbol;
  available: boolean;
  reason?: string; // Why it's unavailable
  marketIndex?: number; // Venue-specific market ID
  minOrderSize?: number;
  tickSize?: number;
  leverage?: number;
}

/**
 * Order object
 */
export interface Order {
  id: string;
  clientId?: string;
  symbol: AllowedSymbol;
  side: Side;
  type: OrderType;
  size: number; // Base currency amount
  price?: number; // Limit price (if applicable)
  triggerPrice?: number; // Stop/TP trigger
  leverage: number;
  status: OrderStatus;
  filledSize: number;
  averageFillPrice?: number;
  reduceOnly: boolean;
  timestamp: number;
  updatedAt: number;
  fee?: number;
  error?: string;
}

/**
 * Position object
 */
export interface Position {
  id: string;
  symbol: AllowedSymbol;
  side: Side;
  size: number; // Absolute size
  entryPrice: number;
  markPrice?: number;
  leverage: number;
  margin: number; // Collateral allocated
  unrealizedPnl: number;
  realizedPnl: number;
  status: PositionStatus;
  openedAt: number;
  closedAt?: number;
  stopLossOrderId?: string;
  takeProfitOrderId?: string;
}

/**
 * Trade (filled order)
 */
export interface Trade {
  id: string;
  orderId: string;
  symbol: AllowedSymbol;
  side: Side;
  size: number;
  price: number;
  fee: number;
  timestamp: number;
  positionId?: string;
}

/**
 * Account equity snapshot
 */
export interface EquitySnapshot {
  timestamp: number;
  totalEquity: number;
  freeCollateral: number;
  usedMargin: number;
  unrealizedPnl: number;
  dailyPnl: number;
}

/**
 * Trading signal
 */
export interface TradingSignal {
  symbol: AllowedSymbol;
  type: SignalType;
  timestamp: number;
  price: number;
  confidence?: number;
  metadata?: Record<string, any>;
}

/**
 * Candlestick data
 */
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Risk state
 */
export interface RiskState {
  dailyPnl: number;
  dailyPnlPct: number;
  consecutiveLosses: number;
  lastLossTime?: number;
  cooldownUntil?: number;
  isDailyLossCapHit: boolean;
  isConsecutiveLossLimitHit: boolean;
  canTrade: boolean;
  reason?: string;
}

/**
 * Bot state (for UI)
 */
export interface BotState {
  status: BotStatus;
  mode: TradingMode;
  activeSymbol: AllowedSymbol;
  walletAddress?: string;
  equity: EquitySnapshot;
  position?: Position;
  openOrders: Order[];
  riskState: RiskState;
  lastSignal?: TradingSignal;
  errorMessage?: string;
}

/**
 * Log entry
 */
export interface LogEntry {
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, any>;
}

/**
 * API Response types
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * WebSocket message types
 */
export enum WsMessageType {
  BOT_STATE = "BOT_STATE",
  LOG = "LOG",
  TRADE = "TRADE",
  POSITION_UPDATE = "POSITION_UPDATE",
  ORDER_UPDATE = "ORDER_UPDATE",
}

export interface WsMessage {
  type: WsMessageType;
  payload: any;
  timestamp: number;
}
