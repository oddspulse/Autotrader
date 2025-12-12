import {
  DriftClient,
  User,
  UserAccount,
  PerpMarketAccount,
  initialize,
  Wallet,
  BN,
  PositionDirection,
  OrderType as DriftOrderType,
  MarketType,
  OrderParams,
  PostOnlyParams,
  convertToNumber,
  calculateMarketMarginRatio,
  QUOTE_PRECISION,
  BASE_PRECISION,
} from "@drift-labs/sdk";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
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
  timeframeToSeconds,
} from "@autotrader/shared";
import { IExchangeAdapter } from "./IExchangeAdapter";
import { logger } from "../utils/logger";
import Decimal from "decimal.js";

/**
 * Drift Protocol exchange adapter implementation
 *
 * COLLATERAL: Drift uses USDC as the primary collateral (quote currency).
 * EQUITY: Retrieved via getUserAccount().totalCollateral
 * SYMBOLS: Maps allowed symbols to Drift market indexes
 *
 * NOTE: Drift requires transaction signing. In production, this adapter
 * would integrate with Phantom wallet for signing. For now, it uses a
 * dummy keypair for read-only operations and throws on write operations.
 */
export class DriftAdapter implements IExchangeAdapter {
  private connection: Connection;
  private driftClient?: DriftClient;
  private user?: User;
  private walletPubkey?: PublicKey;

  // Symbol to market index mapping
  // NOTE: These are mainnet-beta market indexes. Update for devnet if needed.
  private symbolToMarket: Map<AllowedSymbol, number> = new Map([
    ["SOL", 0],  // SOL-PERP
    ["BTC", 1],  // BTC-PERP
    ["ETH", 2],  // ETH-PERP
    // HYPE and ZEC may not be available on Drift - they'll show as unavailable
  ]);

  private priceSubscriptions: Map<AllowedSymbol, ((price: number) => void)[]> = new Map();
  private positionCallback?: (position: Position | null) => void;
  private ordersCallback?: (orders: Order[]) => void;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, "confirmed");
  }

  async initialize(walletPublicKey: string): Promise<void> {
    try {
      this.walletPubkey = new PublicKey(walletPublicKey);

      // For read-only operations, create a dummy wallet
      // In production with Phantom, this would be replaced with actual wallet adapter
      const dummyKeypair = Keypair.generate();
      const wallet: Wallet = {
        publicKey: this.walletPubkey,
        signTransaction: async (tx) => {
          throw new Error("Transaction signing requires Phantom wallet - not implemented in adapter");
        },
        signAllTransactions: async (txs) => {
          throw new Error("Transaction signing requires Phantom wallet - not implemented in adapter");
        },
      };

      // Initialize Drift client
      this.driftClient = new DriftClient({
        connection: this.connection,
        wallet: wallet as any,
        env: "mainnet-beta",
      });

      await this.driftClient.subscribe();

      // Get user account
      const userAccountPublicKey = await this.driftClient.getUserAccountPublicKey();

      // Subscribe to user account
      // Note: User might not have an account yet, handle gracefully
      try {
        this.user = new User({
          driftClient: this.driftClient,
          userAccountPublicKey,
        });
        await this.user.subscribe();
      } catch (error) {
        logger.warn("User account not found - user may need to deposit collateral first");
      }

      logger.info("Drift adapter initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Drift adapter", error);
      throw error;
    }
  }

  async getMarkets(): Promise<MarketInfo[]> {
    const markets: MarketInfo[] = [];

    for (const [symbol, marketIndex] of this.symbolToMarket.entries()) {
      try {
        const marketAccount = this.driftClient!.getPerpMarketAccount(marketIndex);
        if (marketAccount) {
          markets.push({
            symbol,
            available: true,
            marketIndex,
            minOrderSize: convertToNumber(marketAccount.amm.minOrderSize, BASE_PRECISION),
            tickSize: 0.0001, // Drift uses dynamic pricing
            leverage: 10, // Max leverage on Drift
          });
        }
      } catch (error) {
        markets.push({
          symbol,
          available: false,
          reason: "Market not found on Drift",
        });
      }
    }

    // Add unavailable markets (HYPE, ZEC if not in map)
    const allSymbols: AllowedSymbol[] = ["BTC", "ETH", "SOL", "HYPE", "ZEC"];
    for (const symbol of allSymbols) {
      if (!this.symbolToMarket.has(symbol)) {
        markets.push({
          symbol,
          available: false,
          reason: "Not supported on Drift Protocol",
        });
      }
    }

    return markets;
  }

  async getMarketInfo(symbol: AllowedSymbol): Promise<MarketInfo | null> {
    const markets = await this.getMarkets();
    return markets.find((m) => m.symbol === symbol) || null;
  }

  async getEquity(): Promise<{
    totalEquity: number;
    freeCollateral: number;
    usedMargin: number;
    unrealizedPnl: number;
  }> {
    if (!this.user) {
      return {
        totalEquity: 0,
        freeCollateral: 0,
        usedMargin: 0,
        unrealizedPnl: 0,
      };
    }

    const userAccount = this.user.getUserAccount();
    const totalCollateral = convertToNumber(userAccount.totalDeposits, QUOTE_PRECISION);
    const unrealizedPnl = convertToNumber(
      this.user.getUnrealizedPNL(true),
      QUOTE_PRECISION
    );

    const totalEquity = totalCollateral + unrealizedPnl;
    const usedMargin = convertToNumber(
      this.user.getTotalCollateral(),
      QUOTE_PRECISION
    );
    const freeCollateral = totalEquity - usedMargin;

    return {
      totalEquity,
      freeCollateral,
      usedMargin,
      unrealizedPnl,
    };
  }

  async getPosition(symbol: AllowedSymbol): Promise<Position | null> {
    if (!this.user) return null;

    const marketIndex = this.symbolToMarket.get(symbol);
    if (marketIndex === undefined) return null;

    const perpPosition = this.user.getPerpPosition(marketIndex);
    if (!perpPosition || perpPosition.baseAssetAmount.eq(new BN(0))) {
      return null;
    }

    const baseAmount = convertToNumber(perpPosition.baseAssetAmount.abs(), BASE_PRECISION);
    const entryPrice = convertToNumber(perpPosition.quoteAssetAmount.abs(), QUOTE_PRECISION) / baseAmount;
    const marketAccount = this.driftClient!.getPerpMarketAccount(marketIndex)!;
    const markPrice = convertToNumber(marketAccount.amm.lastMarkPriceTwap, QUOTE_PRECISION);

    const unrealizedPnl = convertToNumber(
      this.user.getUnrealizedPNL(true, marketIndex),
      QUOTE_PRECISION
    );

    const side = perpPosition.baseAssetAmount.gt(new BN(0)) ? Side.LONG : Side.SHORT;

    return {
      id: `${symbol}-${marketIndex}`,
      symbol,
      side,
      size: baseAmount,
      entryPrice,
      markPrice,
      leverage: 10, // Approximate, Drift calculates dynamically
      margin: baseAmount * entryPrice / 10, // Approximate
      unrealizedPnl,
      realizedPnl: 0, // Not tracked in this snapshot
      status: PositionStatus.OPEN,
      openedAt: Date.now(), // Not available from Drift, approximate
    };
  }

  async getPositions(): Promise<Position[]> {
    if (!this.user) return [];

    const positions: Position[] = [];
    for (const symbol of this.symbolToMarket.keys()) {
      const position = await this.getPosition(symbol);
      if (position) {
        positions.push(position);
      }
    }
    return positions;
  }

  async getOrders(symbol?: AllowedSymbol): Promise<Order[]> {
    if (!this.user) return [];

    const userAccount = this.user.getUserAccount();
    const orders: Order[] = [];

    for (const order of userAccount.orders) {
      if (order.status === 0) continue; // Skip inactive orders

      const orderMarketIndex = order.marketIndex;
      const orderSymbol = Array.from(this.symbolToMarket.entries()).find(
        ([, idx]) => idx === orderMarketIndex
      )?.[0];

      if (!orderSymbol || (symbol && orderSymbol !== symbol)) continue;

      orders.push({
        id: order.orderId.toString(),
        symbol: orderSymbol,
        side: order.direction === PositionDirection.LONG ? Side.LONG : Side.SHORT,
        type: this.mapDriftOrderType(order.orderType),
        size: convertToNumber(order.baseAssetAmount, BASE_PRECISION),
        price: order.price ? convertToNumber(order.price, QUOTE_PRECISION) : undefined,
        triggerPrice: order.triggerPrice ? convertToNumber(order.triggerPrice, QUOTE_PRECISION) : undefined,
        leverage: 10,
        status: OrderStatus.OPEN,
        filledSize: 0,
        reduceOnly: order.reduceOnly,
        timestamp: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return orders;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    const orders = await this.getOrders();
    return orders.find((o) => o.id === orderId) || null;
  }

  async placeMarketOrder(
    symbol: AllowedSymbol,
    side: Side,
    size: number,
    leverage: number,
    reduceOnly = false
  ): Promise<Order> {
    this.validateSymbol(symbol);

    // This would require Phantom wallet signing in production
    throw new Error(
      "Order placement requires Phantom wallet integration. " +
      "This adapter is read-only until wallet signing is implemented."
    );

    // Implementation pseudocode (requires wallet):
    // const marketIndex = this.symbolToMarket.get(symbol)!;
    // const orderParams: OrderParams = {
    //   orderType: DriftOrderType.MARKET,
    //   marketIndex,
    //   direction: side === Side.LONG ? PositionDirection.LONG : PositionDirection.SHORT,
    //   baseAssetAmount: new BN(size * BASE_PRECISION.toNumber()),
    //   reduceOnly,
    // };
    // const tx = await this.driftClient!.placeOrder(orderParams);
    // return order object
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
    throw new Error("Order placement requires Phantom wallet integration");
  }

  async placeStopLoss(
    symbol: AllowedSymbol,
    side: Side,
    size: number,
    triggerPrice: number
  ): Promise<Order> {
    this.validateSymbol(symbol);
    throw new Error("Order placement requires Phantom wallet integration");
  }

  async placeTakeProfit(
    symbol: AllowedSymbol,
    side: Side,
    size: number,
    triggerPrice: number
  ): Promise<Order> {
    this.validateSymbol(symbol);
    throw new Error("Order placement requires Phantom wallet integration");
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    throw new Error("Order cancellation requires Phantom wallet integration");
  }

  async cancelAllOrders(symbol: AllowedSymbol): Promise<number> {
    this.validateSymbol(symbol);
    throw new Error("Order cancellation requires Phantom wallet integration");
  }

  async getCandles(
    symbol: AllowedSymbol,
    timeframe: Timeframe,
    limit: number
  ): Promise<Candle[]> {
    this.validateSymbol(symbol);

    // Drift doesn't provide historical OHLCV data directly
    // In production, you would:
    // 1. Use a data provider like Pyth or Switchboard
    // 2. Use Drift's historical trades API
    // 3. Use a third-party market data service

    logger.warn("Candle data not implemented - requires external data provider");
    return [];
  }

  async getCurrentPrice(symbol: AllowedSymbol): Promise<number> {
    this.validateSymbol(symbol);

    const marketIndex = this.symbolToMarket.get(symbol);
    if (marketIndex === undefined) {
      throw new Error(`Market not available for ${symbol}`);
    }

    const marketAccount = this.driftClient!.getPerpMarketAccount(marketIndex);
    if (!marketAccount) {
      throw new Error(`Market account not found for ${symbol}`);
    }

    return convertToNumber(marketAccount.amm.lastMarkPriceTwap, QUOTE_PRECISION);
  }

  subscribePrice(symbol: AllowedSymbol, callback: (price: number) => void): void {
    if (!this.priceSubscriptions.has(symbol)) {
      this.priceSubscriptions.set(symbol, []);
    }
    this.priceSubscriptions.get(symbol)!.push(callback);

    // Start polling for price updates (WebSocket would be better)
    this.startPricePolling(symbol);
  }

  subscribePosition(callback: (position: Position | null) => void): void {
    this.positionCallback = callback;
    // Start polling for position updates
    this.startPositionPolling();
  }

  subscribeOrders(callback: (orders: Order[]) => void): void {
    this.ordersCallback = callback;
    // Start polling for order updates
    this.startOrdersPolling();
  }

  async estimateFees(symbol: AllowedSymbol, size: number, price: number): Promise<number> {
    // Drift fees are typically 0.05% for takers, 0.00% for makers
    const notionalValue = size * price;
    const feeRate = 0.0005; // 0.05%
    return notionalValue * feeRate;
  }

  async estimateSlippage(symbol: AllowedSymbol, side: Side, size: number): Promise<number> {
    this.validateSymbol(symbol);

    const marketIndex = this.symbolToMarket.get(symbol);
    if (marketIndex === undefined) return 0;

    const marketAccount = this.driftClient!.getPerpMarketAccount(marketIndex);
    if (!marketAccount) return 0;

    // Simplified slippage estimation based on AMM liquidity
    // Real calculation would use AMM curve math
    const liquidity = convertToNumber(marketAccount.amm.sqrtK, BASE_PRECISION);
    const impactFactor = size / liquidity;
    return Math.min(impactFactor * 100, 1.0); // Cap at 1%
  }

  async disconnect(): Promise<void> {
    if (this.user) {
      await this.user.unsubscribe();
    }
    if (this.driftClient) {
      await this.driftClient.unsubscribe();
    }
    logger.info("Drift adapter disconnected");
  }

  // Helper methods

  private validateSymbol(symbol: AllowedSymbol): void {
    if (!isAllowedSymbol(symbol)) {
      throw new Error(`Symbol ${symbol} is not in the allowlist`);
    }
    if (!this.symbolToMarket.has(symbol)) {
      throw new Error(`Symbol ${symbol} is not supported on Drift`);
    }
  }

  private mapDriftOrderType(driftType: DriftOrderType): OrderType {
    switch (driftType) {
      case DriftOrderType.MARKET:
        return OrderType.MARKET;
      case DriftOrderType.LIMIT:
        return OrderType.LIMIT;
      case DriftOrderType.TRIGGER_MARKET:
        return OrderType.STOP_MARKET;
      case DriftOrderType.TRIGGER_LIMIT:
        return OrderType.STOP_LIMIT;
      default:
        return OrderType.MARKET;
    }
  }

  private async startPricePolling(symbol: AllowedSymbol): Promise<void> {
    setInterval(async () => {
      try {
        const price = await this.getCurrentPrice(symbol);
        const callbacks = this.priceSubscriptions.get(symbol) || [];
        callbacks.forEach((cb) => cb(price));
      } catch (error) {
        logger.error(`Price polling error for ${symbol}`, error);
      }
    }, 1000); // Poll every second
  }

  private async startPositionPolling(): Promise<void> {
    setInterval(async () => {
      if (!this.positionCallback) return;
      try {
        // For simplicity, check all symbols - in production, optimize this
        const positions = await this.getPositions();
        const position = positions.length > 0 ? positions[0] : null;
        this.positionCallback(position);
      } catch (error) {
        logger.error("Position polling error", error);
      }
    }, 2000); // Poll every 2 seconds
  }

  private async startOrdersPolling(): Promise<void> {
    setInterval(async () => {
      if (!this.ordersCallback) return;
      try {
        const orders = await this.getOrders();
        this.ordersCallback(orders);
      } catch (error) {
        logger.error("Orders polling error", error);
      }
    }, 2000); // Poll every 2 seconds
  }
}
