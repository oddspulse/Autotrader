import {
  AllowedSymbol,
  Side,
  OrderType,
  Order,
  Position,
  MarketInfo,
  Candle,
  Timeframe,
} from "@autotrader/shared";

/**
 * Exchange adapter interface
 * All exchange implementations must adhere to this interface
 */
export interface IExchangeAdapter {
  /**
   * Initialize the exchange connection
   */
  initialize(walletPublicKey: string): Promise<void>;

  /**
   * Get available markets and their info
   */
  getMarkets(): Promise<MarketInfo[]>;

  /**
   * Get specific market info
   */
  getMarketInfo(symbol: AllowedSymbol): Promise<MarketInfo | null>;

  /**
   * Get current account equity
   */
  getEquity(): Promise<{
    totalEquity: number;
    freeCollateral: number;
    usedMargin: number;
    unrealizedPnl: number;
  }>;

  /**
   * Get current position for a symbol (null if no position)
   */
  getPosition(symbol: AllowedSymbol): Promise<Position | null>;

  /**
   * Get all open positions
   */
  getPositions(): Promise<Position[]>;

  /**
   * Get all open orders
   */
  getOrders(symbol?: AllowedSymbol): Promise<Order[]>;

  /**
   * Get order by ID
   */
  getOrder(orderId: string): Promise<Order | null>;

  /**
   * Place a market order
   * Returns the order object with generated ID
   */
  placeMarketOrder(
    symbol: AllowedSymbol,
    side: Side,
    size: number,
    leverage: number,
    reduceOnly?: boolean
  ): Promise<Order>;

  /**
   * Place a limit order
   */
  placeLimitOrder(
    symbol: AllowedSymbol,
    side: Side,
    size: number,
    price: number,
    leverage: number,
    reduceOnly?: boolean
  ): Promise<Order>;

  /**
   * Place a stop-loss order (reduce-only)
   */
  placeStopLoss(
    symbol: AllowedSymbol,
    side: Side, // Opposite of position side
    size: number,
    triggerPrice: number
  ): Promise<Order>;

  /**
   * Place a take-profit order (reduce-only)
   */
  placeTakeProfit(
    symbol: AllowedSymbol,
    side: Side, // Opposite of position side
    size: number,
    triggerPrice: number
  ): Promise<Order>;

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string): Promise<boolean>;

  /**
   * Cancel all orders for a symbol
   */
  cancelAllOrders(symbol: AllowedSymbol): Promise<number>;

  /**
   * Get historical candles
   */
  getCandles(
    symbol: AllowedSymbol,
    timeframe: Timeframe,
    limit: number
  ): Promise<Candle[]>;

  /**
   * Get current price for a symbol
   */
  getCurrentPrice(symbol: AllowedSymbol): Promise<number>;

  /**
   * Subscribe to price updates (WebSocket if available)
   */
  subscribePrice(
    symbol: AllowedSymbol,
    callback: (price: number) => void
  ): void;

  /**
   * Subscribe to position updates
   */
  subscribePosition(callback: (position: Position | null) => void): void;

  /**
   * Subscribe to order updates
   */
  subscribeOrders(callback: (orders: Order[]) => void): void;

  /**
   * Estimate order fees
   */
  estimateFees(symbol: AllowedSymbol, size: number, price: number): Promise<number>;

  /**
   * Estimate slippage for market order
   */
  estimateSlippage(symbol: AllowedSymbol, side: Side, size: number): Promise<number>;

  /**
   * Close connection
   */
  disconnect(): Promise<void>;
}
