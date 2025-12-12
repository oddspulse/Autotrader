import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import {
  Trade,
  Order,
  Position,
  EquitySnapshot,
  LogEntry,
  TradingSignal,
} from "@autotrader/shared";
import { logger } from "../utils/logger";

/**
 * SQLite database for persistent storage
 *
 * Stores:
 * - Trades (all executed trades)
 * - Orders (order history)
 * - Positions (position history)
 * - Equity snapshots (periodic equity tracking)
 * - Logs (all log entries)
 * - Signals (trading signals history)
 */
export class TradingDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");

    this.initialize();
    logger.info(`Database initialized at ${dbPath}`);
  }

  private initialize(): void {
    // Trades table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        size REAL NOT NULL,
        price REAL NOT NULL,
        fee REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        position_id TEXT,
        metadata TEXT
      )
    `);

    // Orders table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        client_id TEXT,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        type TEXT NOT NULL,
        size REAL NOT NULL,
        price REAL,
        trigger_price REAL,
        leverage REAL NOT NULL,
        status TEXT NOT NULL,
        filled_size REAL NOT NULL,
        average_fill_price REAL,
        reduce_only INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        fee REAL,
        error TEXT,
        metadata TEXT
      )
    `);

    // Positions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        size REAL NOT NULL,
        entry_price REAL NOT NULL,
        leverage REAL NOT NULL,
        margin REAL NOT NULL,
        unrealized_pnl REAL NOT NULL,
        realized_pnl REAL NOT NULL,
        status TEXT NOT NULL,
        opened_at INTEGER NOT NULL,
        closed_at INTEGER,
        stop_loss_order_id TEXT,
        take_profit_order_id TEXT,
        metadata TEXT
      )
    `);

    // Equity snapshots table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS equity_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        total_equity REAL NOT NULL,
        free_collateral REAL NOT NULL,
        used_margin REAL NOT NULL,
        unrealized_pnl REAL NOT NULL,
        daily_pnl REAL NOT NULL
      )
    `);

    // Logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT
      )
    `);

    // Signals table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        price REAL NOT NULL,
        confidence REAL,
        metadata TEXT
      )
    `);

    // Create indexes
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_positions_opened_at ON positions(opened_at)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_equity_timestamp ON equity_snapshots(timestamp)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp)`);
  }

  // Trade operations

  saveTrade(trade: Trade): void {
    const stmt = this.db.prepare(`
      INSERT INTO trades (id, order_id, symbol, side, size, price, fee, timestamp, position_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      trade.id,
      trade.orderId,
      trade.symbol,
      trade.side,
      trade.size,
      trade.price,
      trade.fee,
      trade.timestamp,
      trade.positionId || null,
      null
    );
  }

  getTrades(limit: number = 100): Trade[] {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(this.rowToTrade);
  }

  getTradesBySymbol(symbol: string, limit: number = 100): Trade[] {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE symbol = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(symbol, limit) as any[];
    return rows.map(this.rowToTrade);
  }

  // Order operations

  saveOrder(order: Order): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO orders
      (id, client_id, symbol, side, type, size, price, trigger_price, leverage, status,
       filled_size, average_fill_price, reduce_only, timestamp, updated_at, fee, error, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      order.id,
      order.clientId || null,
      order.symbol,
      order.side,
      order.type,
      order.size,
      order.price || null,
      order.triggerPrice || null,
      order.leverage,
      order.status,
      order.filledSize,
      order.averageFillPrice || null,
      order.reduceOnly ? 1 : 0,
      order.timestamp,
      order.updatedAt,
      order.fee || null,
      order.error || null,
      null
    );
  }

  // Position operations

  savePosition(position: Position): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO positions
      (id, symbol, side, size, entry_price, leverage, margin, unrealized_pnl, realized_pnl,
       status, opened_at, closed_at, stop_loss_order_id, take_profit_order_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      position.id,
      position.symbol,
      position.side,
      position.size,
      position.entryPrice,
      position.leverage,
      position.margin,
      position.unrealizedPnl,
      position.realizedPnl,
      position.status,
      position.openedAt,
      position.closedAt || null,
      position.stopLossOrderId || null,
      position.takeProfitOrderId || null,
      null
    );
  }

  getPositions(limit: number = 100): Position[] {
    const stmt = this.db.prepare(`
      SELECT * FROM positions
      ORDER BY opened_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(this.rowToPosition);
  }

  // Equity snapshot operations

  saveEquitySnapshot(snapshot: EquitySnapshot): void {
    const stmt = this.db.prepare(`
      INSERT INTO equity_snapshots (timestamp, total_equity, free_collateral, used_margin, unrealized_pnl, daily_pnl)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      snapshot.timestamp,
      snapshot.totalEquity,
      snapshot.freeCollateral,
      snapshot.usedMargin,
      snapshot.unrealizedPnl,
      snapshot.dailyPnl
    );
  }

  getEquitySnapshots(limit: number = 1000): EquitySnapshot[] {
    const stmt = this.db.prepare(`
      SELECT * FROM equity_snapshots
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(this.rowToEquitySnapshot);
  }

  // Log operations

  saveLog(log: LogEntry): void {
    const stmt = this.db.prepare(`
      INSERT INTO logs (timestamp, level, message, data)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      log.timestamp,
      log.level,
      log.message,
      log.data ? JSON.stringify(log.data) : null
    );
  }

  getLogs(limit: number = 1000): LogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM logs
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(this.rowToLog);
  }

  // Signal operations

  saveSignal(signal: TradingSignal): void {
    const stmt = this.db.prepare(`
      INSERT INTO signals (symbol, type, timestamp, price, confidence, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      signal.symbol,
      signal.type,
      signal.timestamp,
      signal.price,
      signal.confidence || null,
      signal.metadata ? JSON.stringify(signal.metadata) : null
    );
  }

  getSignals(limit: number = 1000): TradingSignal[] {
    const stmt = this.db.prepare(`
      SELECT * FROM signals
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(this.rowToSignal);
  }

  // Export to CSV

  exportTradesToCSV(): string {
    const trades = this.getTrades(10000);
    const headers = "id,order_id,symbol,side,size,price,fee,timestamp,position_id\n";
    const rows = trades.map((t) =>
      `${t.id},${t.orderId},${t.symbol},${t.side},${t.size},${t.price},${t.fee},${t.timestamp},${t.positionId || ""}`
    ).join("\n");

    return headers + rows;
  }

  // Utility methods

  close(): void {
    this.db.close();
  }

  // Row mapping functions

  private rowToTrade(row: any): Trade {
    return {
      id: row.id,
      orderId: row.order_id,
      symbol: row.symbol,
      side: row.side,
      size: row.size,
      price: row.price,
      fee: row.fee,
      timestamp: row.timestamp,
      positionId: row.position_id,
    };
  }

  private rowToPosition(row: any): Position {
    return {
      id: row.id,
      symbol: row.symbol,
      side: row.side,
      size: row.size,
      entryPrice: row.entry_price,
      leverage: row.leverage,
      margin: row.margin,
      unrealizedPnl: row.unrealized_pnl,
      realizedPnl: row.realized_pnl,
      status: row.status,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      stopLossOrderId: row.stop_loss_order_id,
      takeProfitOrderId: row.take_profit_order_id,
    };
  }

  private rowToEquitySnapshot(row: any): EquitySnapshot {
    return {
      timestamp: row.timestamp,
      totalEquity: row.total_equity,
      freeCollateral: row.free_collateral,
      usedMargin: row.used_margin,
      unrealizedPnl: row.unrealized_pnl,
      dailyPnl: row.daily_pnl,
    };
  }

  private rowToLog(row: any): LogEntry {
    return {
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
      data: row.data ? JSON.parse(row.data) : undefined,
    };
  }

  private rowToSignal(row: any): TradingSignal {
    return {
      symbol: row.symbol,
      type: row.type,
      timestamp: row.timestamp,
      price: row.price,
      confidence: row.confidence,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
