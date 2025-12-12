import {
  AllowedSymbol,
  Side,
  OrderType,
  Order,
  Position,
  MarketInfo,
  Candle,
  Timeframe,
  OrderStatus,
  PositionStatus,
  isAllowedSymbol,
} from "@autotrader/shared";
import { IExchangeAdapter } from "./IExchangeAdapter";
import { logger } from "../utils/logger";
import Decimal from "decimal.js";

/**
 * Paper trading simulator
 *
 * Simulates order execution, position management, and PnL tracking
 * without interacting with real exchanges.
 *
 * Features:
 * - Realistic fill simulation with spread/slippage
 * - Fee modeling (0.05% taker, 0.02% maker)
 * - Stop-loss and take-profit trigger logic
 * - Position tracking with mark-to-market PnL
 */
export class PaperTradingAdapter implements IExchangeAdapter {
  private equity: Decimal;
  private initialEquity: Decimal;
  private positions: Map<AllowedSymbol, Position>;
  private orders: Map<string, Order>;
  private currentPrices: Map<AllowedSymbol, number>;
  private nextOrderId: number;
  private nextPositionId: number;

  // Callbacks
  private priceSubscriptions: Map<AllowedSymbol, ((price: number) => void)[]>;
  private positionCallback?: (position: Position | null) => void;
  private ordersCallback?: (orders: Order[]) => void;

  // Simulation parameters
  private readonly TAKER_FEE = 0.0005; // 0.05%
  private readonly MAKER_FEE = 0.0002; // 0.02%
  private readonly SPREAD_PCT = 0.0001; // 0.01% spread
  private readonly SLIPPAGE_BASE = 0.0002; // 0.02% base slippage

  // Available markets (all allowed symbols available in paper mode)
  private readonly markets: Map<AllowedSymbol, MarketInfo> = new Map([
    ["BTC", { symbol: "BTC", available: true, minOrderSize: 0.001, tickSize: 0.01, leverage: 10 }],
    ["ETH", { symbol: "ETH", available: true, minOrderSize: 0.01, tickSize: 0.01, leverage: 10 }],
    ["SOL", { symbol: "SOL", available: true, minOrderSize: 0.1, tickSize: 0.001, leverage: 10 }],
    ["HYPE", { symbol: "HYPE", available: true, minOrderSize: 1, tickSize: 0.0001, leverage: 10 }],
    ["ZEC", { symbol: "ZEC", available: true, minOrderSize: 0.1, tickSize: 0.01, leverage: 10 }],
  ]);

  constructor(initialEquity: number = 10000) {
    this.equity = new Decimal(initialEquity);
    this.initialEquity = new Decimal(initialEquity);
    this.positions = new Map();
    this.orders = new Map();
    this.currentPrices = new Map();
    this.priceSubscriptions = new Map();
    this.nextOrderId = 1;
    this.nextPositionId = 1;

    logger.info(`Paper trading adapter initialized with $${initialEquity} equity`);
  }

  async initialize(walletPublicKey: string): Promise<void> {
    logger.info(`Paper trading initialized for wallet ${walletPublicKey}`);
  }

  async getMarkets(): Promise<MarketInfo[]> {
    return Array.from(this.markets.values());
  }

  async getMarketInfo(symbol: AllowedSymbol): Promise<MarketInfo | null> {
    return this.markets.get(symbol) || null;
  }

  async getEquity(): Promise<{
    totalEquity: number;
    freeCollateral: number;
    usedMargin: number;
    unrealizedPnl: number;
  }> {
    let unrealizedPnl = new Decimal(0);
    let usedMargin = new Decimal(0);

    for (const position of this.positions.values()) {
      const currentPrice = this.currentPrices.get(position.symbol) || position.entryPrice;
      const pnl = this.calculatePositionPnl(position, currentPrice);
      unrealizedPnl = unrealizedPnl.plus(pnl);
      usedMargin = usedMargin.plus(position.margin);
    }

    const totalEquity = this.equity.plus(unrealizedPnl);
    const freeCollateral = totalEquity.minus(usedMargin);

    return {
      totalEquity: totalEquity.toNumber(),
      freeCollateral: freeCollateral.toNumber(),
      usedMargin: usedMargin.toNumber(),
      unrealizedPnl: unrealizedPnl.toNumber(),
    };
  }

  async getPosition(symbol: AllowedSymbol): Promise<Position | null> {
    const position = this.positions.get(symbol);
    if (!position) return null;

    // Update with current price
    const currentPrice = this.currentPrices.get(symbol) || position.entryPrice;
    const unrealizedPnl = this.calculatePositionPnl(position, currentPrice);

    return {
      ...position,
      markPrice: currentPrice,
      unrealizedPnl,
    };
  }

  async getPositions(): Promise<Position[]> {
    const positions: Position[] = [];
    for (const symbol of this.positions.keys()) {
      const position = await this.getPosition(symbol);
      if (position) positions.push(position);
    }
    return positions;
  }

  async getOrders(symbol?: AllowedSymbol): Promise<Order[]> {
    const orders = Array.from(this.orders.values());
    if (symbol) {
      return orders.filter((o) => o.symbol === symbol);
    }
    return orders;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  async placeMarketOrder(
    symbol: AllowedSymbol,
    side: Side,
    size: number,
    leverage: number,
    reduceOnly = false
  ): Promise<Order> {
    this.validateSymbol(symbol);
    this.validateLeverage(leverage);

    const currentPrice = await this.getCurrentPrice(symbol);
    const orderId = `paper-${this.nextOrderId++}`;

    // Simulate slippage
    const slippage = this.calculateSlippage(size, currentPrice);
    const fillPrice = side === Side.LONG
      ? currentPrice * (1 + slippage)
      : currentPrice * (1 - slippage);

    const fee = size * fillPrice * this.TAKER_FEE;

    const order: Order = {
      id: orderId,
      symbol,
      side,
      type: OrderType.MARKET,
      size,
      leverage,
      status: OrderStatus.FILLED,
      filledSize: size,
      averageFillPrice: fillPrice,
      reduceOnly,
      timestamp: Date.now(),
      updatedAt: Date.now(),
      fee,
    };

    // Execute immediately
    await this.executeOrder(order);

    logger.info(`Paper market order filled: ${side} ${size} ${symbol} @ ${fillPrice.toFixed(4)}`);

    return order;
  }

  async placeLimitOrder(
    symbol: AllowedSymbol,
    side: Side,
    size: number,
    price: number,
    leverage: number,
    reduceOnly = false
  ): Promise<Order> {
    this.validateSymbol(symbol);
    this.validateLeverage(leverage);

    const orderId = `paper-${this.nextOrderId++}`;

    const order: Order = {
      id: orderId,
      symbol,
      side,
      type: OrderType.LIMIT,
      size,
      price,
      leverage,
      status: OrderStatus.OPEN,
      filledSize: 0,
      reduceOnly,
      timestamp: Date.now(),
      updatedAt: Date.now(),
    };

    this.orders.set(orderId, order);

    // Start monitoring for fill
    this.monitorLimitOrder(orderId);

    logger.info(`Paper limit order placed: ${side} ${size} ${symbol} @ ${price}`);

    return order;
  }

  async placeStopLoss(
    symbol: AllowedSymbol,
    side: Side,
    size: number,
    triggerPrice: number
  ): Promise<Order> {
    this.validateSymbol(symbol);

    const orderId = `paper-sl-${this.nextOrderId++}`;

    const order: Order = {
      id: orderId,
      symbol,
      side,
      type: OrderType.STOP_MARKET,
      size,
      triggerPrice,
      leverage: 1,
      status: OrderStatus.OPEN,
      filledSize: 0,
      reduceOnly: true,
      timestamp: Date.now(),
      updatedAt: Date.now(),
    };

    this.orders.set(orderId, order);

    // Start monitoring for trigger
    this.monitorStopOrder(orderId);

    logger.info(`Paper stop-loss placed: ${side} ${size} ${symbol} @ ${triggerPrice}`);

    return order;
  }

  async placeTakeProfit(
    symbol: AllowedSymbol,
    side: Side,
    size: number,
    triggerPrice: number
  ): Promise<Order> {
    this.validateSymbol(symbol);

    const orderId = `paper-tp-${this.nextOrderId++}`;

    const order: Order = {
      id: orderId,
      symbol,
      side,
      type: OrderType.TAKE_PROFIT_MARKET,
      size,
      triggerPrice,
      leverage: 1,
      status: OrderStatus.OPEN,
      filledSize: 0,
      reduceOnly: true,
      timestamp: Date.now(),
      updatedAt: Date.now(),
    };

    this.orders.set(orderId, order);

    // Start monitoring for trigger
    this.monitorTakeProfitOrder(orderId);

    logger.info(`Paper take-profit placed: ${side} ${size} ${symbol} @ ${triggerPrice}`);

    return order;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    order.status = OrderStatus.CANCELLED;
    order.updatedAt = Date.now();

    logger.info(`Paper order cancelled: ${orderId}`);

    return true;
  }

  async cancelAllOrders(symbol: AllowedSymbol): Promise<number> {
    let count = 0;
    for (const [orderId, order] of this.orders.entries()) {
      if (order.symbol === symbol && order.status === OrderStatus.OPEN) {
        await this.cancelOrder(orderId);
        count++;
      }
    }
    return count;
  }

  async getCandles(
    symbol: AllowedSymbol,
    timeframe: Timeframe,
    limit: number
  ): Promise<Candle[]> {
    // Paper mode uses simulated candles from external price feed
    // For now, return empty - would integrate with Pyth/Switchboard in production
    logger.warn("Candle data not available in paper mode - integrate price feed");
    return [];
  }

  async getCurrentPrice(symbol: AllowedSymbol): Promise<number> {
    // Return stored price or fetch from external source
    // In production, this would pull from Pyth, Switchboard, or exchange API
    const price = this.currentPrices.get(symbol);
    if (!price) {
      throw new Error(`No price data for ${symbol}. Ensure price feed is running.`);
    }
    return price;
  }

  subscribePrice(symbol: AllowedSymbol, callback: (price: number) => void): void {
    if (!this.priceSubscriptions.has(symbol)) {
      this.priceSubscriptions.set(symbol, []);
    }
    this.priceSubscriptions.get(symbol)!.push(callback);
  }

  subscribePosition(callback: (position: Position | null) => void): void {
    this.positionCallback = callback;
  }

  subscribeOrders(callback: (orders: Order[]) => void): void {
    this.ordersCallback = callback;
  }

  async estimateFees(symbol: AllowedSymbol, size: number, price: number): Promise<number> {
    const notionalValue = size * price;
    return notionalValue * this.TAKER_FEE;
  }

  async estimateSlippage(symbol: AllowedSymbol, side: Side, size: number): Promise<number> {
    const price = await this.getCurrentPrice(symbol);
    return this.calculateSlippage(size, price);
  }

  async disconnect(): Promise<void> {
    logger.info("Paper trading adapter disconnected");
  }

  // Paper-specific methods

  /**
   * Update price (called by price feed)
   */
  updatePrice(symbol: AllowedSymbol, price: number): void {
    this.currentPrices.set(symbol, price);

    // Notify subscribers
    const callbacks = this.priceSubscriptions.get(symbol) || [];
    callbacks.forEach((cb) => cb(price));
  }

  /**
   * Reset paper account
   */
  reset(): void {
    this.equity = new Decimal(this.initialEquity);
    this.positions.clear();
    this.orders.clear();
    logger.info("Paper trading account reset");
  }

  // Private methods

  private validateSymbol(symbol: AllowedSymbol): void {
    if (!isAllowedSymbol(symbol)) {
      throw new Error(`Symbol ${symbol} is not in the allowlist`);
    }
  }

  private validateLeverage(leverage: number): void {
    if (leverage > 10) {
      throw new Error(`Leverage ${leverage} exceeds maximum of 10x`);
    }
  }

  private calculateSlippage(size: number, price: number): number {
    // Simple slippage model: increases with order size
    const notionalValue = size * price;
    const impactFactor = Math.min(notionalValue / 100000, 1.0);
    return this.SLIPPAGE_BASE * (1 + impactFactor);
  }

  private calculatePositionPnl(position: Position, currentPrice: number): number {
    const priceDiff = position.side === Side.LONG
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;

    return priceDiff * position.size;
  }

  private async executeOrder(order: Order): Promise<void> {
    if (!order.averageFillPrice) {
      throw new Error("Cannot execute order without fill price");
    }

    const fillPrice = order.averageFillPrice;
    const notionalValue = order.size * fillPrice;
    const margin = notionalValue / order.leverage;

    // Check if we have enough free collateral
    const equity = await this.getEquity();
    if (equity.freeCollateral < margin) {
      order.status = OrderStatus.REJECTED;
      order.error = "Insufficient free collateral";
      logger.error(`Order rejected: insufficient collateral`);
      return;
    }

    // If reduce-only, close or reduce existing position
    if (order.reduceOnly) {
      const position = this.positions.get(order.symbol);
      if (position) {
        await this.closePosition(position, fillPrice, order.fee || 0);
      }
      return;
    }

    // Open new position or add to existing
    const existingPosition = this.positions.get(order.symbol);

    if (existingPosition) {
      // Check if same side
      if (existingPosition.side === order.side) {
        // Add to position (not implemented for simplicity - would need to recalculate entry)
        logger.warn("Adding to existing position not implemented in paper mode");
      } else {
        // Close existing opposite position
        await this.closePosition(existingPosition, fillPrice, order.fee || 0);
      }
    }

    // Open new position
    const positionId = `paper-pos-${this.nextPositionId++}`;

    const newPosition: Position = {
      id: positionId,
      symbol: order.symbol,
      side: order.side,
      size: order.size,
      entryPrice: fillPrice,
      markPrice: fillPrice,
      leverage: order.leverage,
      margin,
      unrealizedPnl: 0,
      realizedPnl: 0,
      status: PositionStatus.OPEN,
      openedAt: Date.now(),
    };

    this.positions.set(order.symbol, newPosition);

    // Deduct margin and fees from equity
    this.equity = this.equity.minus(order.fee || 0);

    logger.info(`Position opened: ${order.side} ${order.size} ${order.symbol} @ ${fillPrice}`);

    if (this.positionCallback) {
      this.positionCallback(newPosition);
    }
  }

  private async closePosition(position: Position, exitPrice: number, fee: number): Promise<void> {
    const pnl = this.calculatePositionPnl(position, exitPrice);
    const netPnl = pnl - fee;

    // Update equity
    this.equity = this.equity.plus(netPnl);

    position.status = PositionStatus.CLOSED;
    position.closedAt = Date.now();
    position.realizedPnl = netPnl;

    this.positions.delete(position.symbol);

    logger.info(
      `Position closed: ${position.side} ${position.size} ${position.symbol} @ ${exitPrice}, PnL: ${netPnl.toFixed(2)}`
    );

    if (this.positionCallback) {
      this.positionCallback(null);
    }
  }

  private monitorLimitOrder(orderId: string): void {
    const interval = setInterval(async () => {
      const order = this.orders.get(orderId);
      if (!order || order.status !== OrderStatus.OPEN) {
        clearInterval(interval);
        return;
      }

      const currentPrice = this.currentPrices.get(order.symbol);
      if (!currentPrice || !order.price) return;

      const shouldFill =
        (order.side === Side.LONG && currentPrice <= order.price) ||
        (order.side === Side.SHORT && currentPrice >= order.price);

      if (shouldFill) {
        order.status = OrderStatus.FILLED;
        order.filledSize = order.size;
        order.averageFillPrice = order.price;
        order.fee = order.size * order.price * this.MAKER_FEE;
        order.updatedAt = Date.now();

        await this.executeOrder(order);
        clearInterval(interval);

        if (this.ordersCallback) {
          this.ordersCallback(await this.getOrders());
        }
      }
    }, 500);
  }

  private monitorStopOrder(orderId: string): void {
    const interval = setInterval(async () => {
      const order = this.orders.get(orderId);
      if (!order || order.status !== OrderStatus.OPEN) {
        clearInterval(interval);
        return;
      }

      const currentPrice = this.currentPrices.get(order.symbol);
      if (!currentPrice || !order.triggerPrice) return;

      const shouldTrigger =
        (order.side === Side.SHORT && currentPrice <= order.triggerPrice) ||
        (order.side === Side.LONG && currentPrice >= order.triggerPrice);

      if (shouldTrigger) {
        // Execute as market order
        const slippage = this.calculateSlippage(order.size, currentPrice);
        const fillPrice = order.side === Side.LONG
          ? currentPrice * (1 + slippage)
          : currentPrice * (1 - slippage);

        order.status = OrderStatus.FILLED;
        order.filledSize = order.size;
        order.averageFillPrice = fillPrice;
        order.fee = order.size * fillPrice * this.TAKER_FEE;
        order.updatedAt = Date.now();

        await this.executeOrder(order);
        clearInterval(interval);

        if (this.ordersCallback) {
          this.ordersCallback(await this.getOrders());
        }
      }
    }, 500);
  }

  private monitorTakeProfitOrder(orderId: string): void {
    const interval = setInterval(async () => {
      const order = this.orders.get(orderId);
      if (!order || order.status !== OrderStatus.OPEN) {
        clearInterval(interval);
        return;
      }

      const currentPrice = this.currentPrices.get(order.symbol);
      if (!currentPrice || !order.triggerPrice) return;

      const shouldTrigger =
        (order.side === Side.SHORT && currentPrice <= order.triggerPrice) ||
        (order.side === Side.LONG && currentPrice >= order.triggerPrice);

      if (shouldTrigger) {
        // Execute as market order
        const slippage = this.calculateSlippage(order.size, currentPrice);
        const fillPrice = order.side === Side.LONG
          ? currentPrice * (1 + slippage)
          : currentPrice * (1 - slippage);

        order.status = OrderStatus.FILLED;
        order.filledSize = order.size;
        order.averageFillPrice = fillPrice;
        order.fee = order.size * fillPrice * this.TAKER_FEE;
        order.updatedAt = Date.now();

        await this.executeOrder(order);
        clearInterval(interval);

        if (this.ordersCallback) {
          this.ordersCallback(await this.getOrders());
        }
      }
    }, 500);
  }
}
