import {
  BotConfig,
  BotStatus,
  TradingMode,
  AllowedSymbol,
  SignalType,
  Side,
  Order,
  Position,
  TradingSignal,
  EquitySnapshot,
  isAllowedSymbol,
  BotState,
  OrderStatus,
  WsMessageType,
} from "@autotrader/shared";
import { IExchangeAdapter } from "../exchanges/IExchangeAdapter";
import { DriftAdapter } from "../exchanges/DriftAdapter";
import { PaperTradingAdapter } from "../exchanges/PaperTradingAdapter";
import { IStrategy } from "../strategies/IStrategy";
import { EMACrossoverStrategy } from "../strategies/EMACrossoverStrategy";
import { RiskManager } from "../risk/RiskManager";
import { TradingDatabase } from "../database/Database";
import { logger } from "../utils/logger";
import Decimal from "decimal.js";

/**
 * Main trading bot worker
 *
 * Orchestrates:
 * - Exchange connection
 * - Signal generation
 * - Order placement
 * - Position management
 * - Risk management
 * - TP/SL monitoring
 *
 * Runs in a continuous loop when active.
 */
export class TradingBot {
  private config: BotConfig;
  private exchange: IExchangeAdapter;
  private strategy: IStrategy;
  private riskManager?: RiskManager;
  private database: TradingDatabase;

  private status: BotStatus = BotStatus.STOPPED;
  private currentPosition?: Position;
  private openOrders: Order[] = [];
  private lastSignal?: TradingSignal;
  private equity?: EquitySnapshot;

  private runLoopInterval?: NodeJS.Timeout;
  private equityUpdateInterval?: NodeJS.Timeout;

  private wsCallback?: (message: any) => void;

  constructor(config: BotConfig, database: TradingDatabase) {
    this.config = config;
    this.database = database;

    // Initialize exchange
    if (config.paperTrading) {
      this.exchange = new PaperTradingAdapter(10000); // $10k starting equity
      logger.info("Using paper trading mode");
    } else {
      this.exchange = new DriftAdapter(config.rpcUrl);
      logger.info("Using live trading mode (Drift Protocol)");
    }

    // Initialize strategy
    this.strategy = new EMACrossoverStrategy(config.emaFast, config.emaSlow);
    this.strategy.initialize();

    logger.info("Trading bot initialized", {
      activeSymbol: config.activeSymbol,
      leverage: config.maxLeverage,
      paperTrading: config.paperTrading,
    });
  }

  /**
   * Set WebSocket callback for real-time updates
   */
  setWsCallback(callback: (message: any) => void): void {
    this.wsCallback = callback;
  }

  /**
   * Start the trading bot
   */
  async start(walletAddress: string): Promise<void> {
    if (this.status === BotStatus.RUNNING) {
      logger.warn("Bot is already running");
      return;
    }

    try {
      // Validate active symbol
      if (!isAllowedSymbol(this.config.activeSymbol)) {
        throw new Error(
          `Active symbol ${this.config.activeSymbol} is not in allowlist: ${this.config.symbols.join(", ")}`
        );
      }

      // Initialize exchange
      await this.exchange.initialize(walletAddress);

      // Check market availability
      const marketInfo = await this.exchange.getMarketInfo(this.config.activeSymbol);
      if (!marketInfo || !marketInfo.available) {
        throw new Error(
          `Market ${this.config.activeSymbol} is not available on the exchange: ${marketInfo?.reason || "unknown"}`
        );
      }

      // Get initial equity
      const equityData = await this.exchange.getEquity();
      this.equity = {
        timestamp: Date.now(),
        totalEquity: equityData.totalEquity,
        freeCollateral: equityData.freeCollateral,
        usedMargin: equityData.usedMargin,
        unrealizedPnl: equityData.unrealizedPnl,
        dailyPnl: 0,
      };

      // Initialize risk manager
      this.riskManager = new RiskManager(this.config, this.equity.totalEquity);

      // Start monitoring
      this.startEquityMonitoring();
      this.subscribeToUpdates();

      // Start main trading loop
      this.status = BotStatus.RUNNING;
      this.startTradingLoop();

      logger.info("Trading bot started successfully", {
        equity: this.equity.totalEquity,
        symbol: this.config.activeSymbol,
      });

      this.broadcastState();
    } catch (error) {
      this.status = BotStatus.ERROR;
      logger.error("Failed to start trading bot", error);
      throw error;
    }
  }

  /**
   * Stop the trading bot
   */
  async stop(): Promise<void> {
    if (this.status === BotStatus.STOPPED) {
      logger.warn("Bot is already stopped");
      return;
    }

    this.status = BotStatus.STOPPED;

    // Clear intervals
    if (this.runLoopInterval) clearInterval(this.runLoopInterval);
    if (this.equityUpdateInterval) clearInterval(this.equityUpdateInterval);

    // Disconnect exchange
    await this.exchange.disconnect();

    logger.info("Trading bot stopped");
    this.broadcastState();
  }

  /**
   * Get current bot state
   */
  getState(): BotState {
    return {
      status: this.status,
      mode: this.config.paperTrading ? TradingMode.PAPER : TradingMode.LIVE,
      activeSymbol: this.config.activeSymbol,
      equity: this.equity || {
        timestamp: Date.now(),
        totalEquity: 0,
        freeCollateral: 0,
        usedMargin: 0,
        unrealizedPnl: 0,
        dailyPnl: 0,
      },
      position: this.currentPosition,
      openOrders: this.openOrders,
      riskState: this.riskManager?.getState() || {
        dailyPnl: 0,
        dailyPnlPct: 0,
        consecutiveLosses: 0,
        isDailyLossCapHit: false,
        isConsecutiveLossLimitHit: false,
        canTrade: true,
      },
      lastSignal: this.lastSignal,
    };
  }

  // Private methods

  /**
   * Main trading loop
   */
  private startTradingLoop(): void {
    // Run every 5 seconds (configurable based on timeframe)
    const intervalMs = 5000;

    this.runLoopInterval = setInterval(async () => {
      try {
        await this.runTradingCycle();
      } catch (error) {
        logger.error("Error in trading cycle", error);
      }
    }, intervalMs);

    // Run immediately
    this.runTradingCycle();
  }

  /**
   * Single trading cycle iteration
   */
  private async runTradingCycle(): Promise<void> {
    if (this.status !== BotStatus.RUNNING) return;

    // 1. Check risk state
    const riskCheck = this.riskManager!.canTrade();
    if (!riskCheck.allowed) {
      if (this.status !== BotStatus.PAUSED && this.status !== BotStatus.COOLDOWN) {
        this.status = BotStatus.COOLDOWN;
        logger.warn(`Trading paused: ${riskCheck.reason}`);
        this.broadcastState();
      }
      return;
    }

    // Resume if we were in cooldown
    if (this.status === BotStatus.COOLDOWN) {
      this.status = BotStatus.RUNNING;
      logger.info("Trading resumed");
      this.broadcastState();
    }

    // 2. Update current position
    this.currentPosition = await this.exchange.getPosition(this.config.activeSymbol) || undefined;

    // 3. Update open orders
    this.openOrders = await this.exchange.getOrders(this.config.activeSymbol);

    // 4. Get current price
    const currentPrice = await this.exchange.getCurrentPrice(this.config.activeSymbol);

    // 5. Generate signal (simplified - in production would fetch candles)
    // For now, skip signal generation if we don't have candle data
    // This is where you'd integrate a data provider like Pyth or Switchboard
    const candles = await this.exchange.getCandles(
      this.config.activeSymbol,
      this.config.timeframe,
      this.strategy.getRequiredCandles()
    );

    if (candles.length >= this.strategy.getRequiredCandles()) {
      const signal = this.strategy.generateSignal(
        this.config.activeSymbol,
        candles,
        currentPrice
      );

      this.lastSignal = signal;
      this.database.saveSignal(signal);

      // 6. Act on signal
      await this.processSignal(signal);
    } else {
      logger.debug("Insufficient candle data for signal generation");
    }

    // 7. Monitor existing positions and orders
    await this.monitorPosition();
    await this.monitorOrders();

    this.broadcastState();
  }

  /**
   * Process trading signal
   */
  private async processSignal(signal: TradingSignal): Promise<void> {
    // Ignore NONE signals
    if (signal.type === SignalType.NONE) return;

    // If we have a position, only process CLOSE signals
    if (this.currentPosition) {
      if (signal.type === SignalType.CLOSE) {
        await this.closePosition();
      }
      return;
    }

    // No position - process LONG/SHORT signals
    if (signal.type === SignalType.LONG || signal.type === SignalType.SHORT) {
      await this.openPosition(signal.type === SignalType.LONG ? Side.LONG : Side.SHORT, signal.price);
    }
  }

  /**
   * Open a new position
   */
  private async openPosition(side: Side, entryPrice: number): Promise<void> {
    try {
      // Check if symbol is allowed
      if (!isAllowedSymbol(this.config.activeSymbol)) {
        logger.error(`Symbol ${this.config.activeSymbol} not in allowlist - refusing to trade`);
        return;
      }

      // Calculate position size
      const equity = await this.exchange.getEquity();
      const availableMargin = equity.freeCollateral * this.config.allocationPct; // 60% of free collateral
      const leverage = this.config.maxLeverage;
      const notionalValue = availableMargin * leverage;
      const size = notionalValue / entryPrice;

      logger.info(`Opening ${side} position`, {
        size,
        entryPrice,
        leverage,
        margin: availableMargin,
      });

      // Estimate slippage
      const estimatedSlippage = await this.exchange.estimateSlippage(
        this.config.activeSymbol,
        side,
        size
      );

      const slippageCheck = this.riskManager!.validateSlippage(estimatedSlippage);
      if (!slippageCheck.valid) {
        logger.warn(`Order rejected: ${slippageCheck.reason}`);
        return;
      }

      // Place market order
      const order = await this.exchange.placeMarketOrder(
        this.config.activeSymbol,
        side,
        size,
        leverage,
        false
      );

      this.database.saveOrder(order);

      // If filled, place TP/SL orders
      if (order.status === OrderStatus.FILLED && order.averageFillPrice) {
        await this.placeTpSlOrders(side, size, order.averageFillPrice);
      }

      logger.info(`Position opened successfully: ${order.id}`);
      this.broadcastMessage(WsMessageType.TRADE, order);
    } catch (error) {
      logger.error("Failed to open position", error);
    }
  }

  /**
   * Place take-profit and stop-loss orders
   */
  private async placeTpSlOrders(side: Side, size: number, entryPrice: number): Promise<void> {
    try {
      // Calculate TP/SL prices
      // TP: +20% from entry
      // SL: -5% from entry
      const tpPrice = side === Side.LONG
        ? entryPrice * (1 + this.config.takeProfitPct)
        : entryPrice * (1 - this.config.takeProfitPct);

      const slPrice = side === Side.LONG
        ? entryPrice * (1 - this.config.stopLossPct)
        : entryPrice * (1 + this.config.stopLossPct);

      // Close side is opposite of position side
      const closeSide = side === Side.LONG ? Side.SHORT : Side.LONG;

      // Place TP order
      const tpOrder = await this.exchange.placeTakeProfit(
        this.config.activeSymbol,
        closeSide,
        size,
        tpPrice
      );

      this.database.saveOrder(tpOrder);
      logger.info(`Take-profit order placed at ${tpPrice.toFixed(4)}`);

      // Place SL order
      const slOrder = await this.exchange.placeStopLoss(
        this.config.activeSymbol,
        closeSide,
        size,
        slPrice
      );

      this.database.saveOrder(slOrder);
      logger.info(`Stop-loss order placed at ${slPrice.toFixed(4)}`);
    } catch (error) {
      logger.error("Failed to place TP/SL orders", error);
    }
  }

  /**
   * Close current position
   */
  private async closePosition(): Promise<void> {
    if (!this.currentPosition) return;

    try {
      const closeSide = this.currentPosition.side === Side.LONG ? Side.SHORT : Side.LONG;

      logger.info("Closing position", {
        symbol: this.currentPosition.symbol,
        size: this.currentPosition.size,
      });

      // Cancel TP/SL orders first
      await this.exchange.cancelAllOrders(this.config.activeSymbol);

      // Place market order to close
      const order = await this.exchange.placeMarketOrder(
        this.config.activeSymbol,
        closeSide,
        this.currentPosition.size,
        1,
        true // reduce-only
      );

      this.database.saveOrder(order);

      // Record trade result for risk management
      if (order.averageFillPrice && order.fee) {
        const pnl = this.calculatePnl(
          this.currentPosition,
          order.averageFillPrice
        );
        this.riskManager!.recordTrade(pnl, order.fee);
      }

      logger.info("Position closed successfully");
      this.broadcastMessage(WsMessageType.TRADE, order);
    } catch (error) {
      logger.error("Failed to close position", error);
    }
  }

  /**
   * Monitor existing position for manual intervention needs
   */
  private async monitorPosition(): Promise<void> {
    if (!this.currentPosition) return;

    // Check if TP/SL orders are still active
    const tpSlOrders = this.openOrders.filter(
      (o) => o.reduceOnly && o.status === OrderStatus.OPEN
    );

    if (tpSlOrders.length === 0) {
      logger.warn("No TP/SL orders found for open position - placing new ones");
      await this.placeTpSlOrders(
        this.currentPosition.side,
        this.currentPosition.size,
        this.currentPosition.entryPrice
      );
    }
  }

  /**
   * Monitor orders for timeout/cancellation
   */
  private async monitorOrders(): Promise<void> {
    const now = Date.now();
    const timeoutMs = this.config.orderTimeoutSeconds * 1000;

    for (const order of this.openOrders) {
      if (order.status === OrderStatus.OPEN && !order.reduceOnly) {
        const age = now - order.timestamp;
        if (age > timeoutMs) {
          logger.warn(`Order ${order.id} timed out after ${timeoutMs / 1000}s - cancelling`);
          await this.exchange.cancelOrder(order.id);
        }
      }
    }
  }

  /**
   * Start equity monitoring
   */
  private startEquityMonitoring(): void {
    this.equityUpdateInterval = setInterval(async () => {
      try {
        const equityData = await this.exchange.getEquity();
        this.equity = {
          timestamp: Date.now(),
          totalEquity: equityData.totalEquity,
          freeCollateral: equityData.freeCollateral,
          usedMargin: equityData.usedMargin,
          unrealizedPnl: equityData.unrealizedPnl,
          dailyPnl: 0, // Calculated by risk manager
        };

        this.riskManager!.updateEquity(this.equity);
        this.database.saveEquitySnapshot(this.equity);
      } catch (error) {
        logger.error("Failed to update equity", error);
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Subscribe to exchange updates
   */
  private subscribeToUpdates(): void {
    this.exchange.subscribePrice(this.config.activeSymbol, (price) => {
      // Update paper trading adapter if applicable
      if (this.exchange instanceof PaperTradingAdapter) {
        this.exchange.updatePrice(this.config.activeSymbol, price);
      }
    });

    this.exchange.subscribePosition((position) => {
      if (position) {
        this.currentPosition = position;
        this.database.savePosition(position);
        this.broadcastMessage(WsMessageType.POSITION_UPDATE, position);
      }
    });

    this.exchange.subscribeOrders((orders) => {
      this.openOrders = orders;
    });
  }

  /**
   * Calculate PnL for a position
   */
  private calculatePnl(position: Position, exitPrice: number): number {
    const priceDiff = position.side === Side.LONG
      ? exitPrice - position.entryPrice
      : position.entryPrice - exitPrice;

    return priceDiff * position.size;
  }

  /**
   * Broadcast state to WebSocket clients
   */
  private broadcastState(): void {
    if (this.wsCallback) {
      this.wsCallback({
        type: WsMessageType.BOT_STATE,
        payload: this.getState(),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Broadcast message to WebSocket clients
   */
  private broadcastMessage(type: WsMessageType, payload: any): void {
    if (this.wsCallback) {
      this.wsCallback({
        type,
        payload,
        timestamp: Date.now(),
      });
    }
  }
}
