"""Database storage via Supabase Postgres."""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("autotrader.storage")

try:
    import psycopg2
    import psycopg2.extras
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False


class Storage:
    """
    Postgres/Supabase storage backend.

    Stores trades, equity snapshots, bot status, positions, and Kelly stats.
    Falls back to local JSON if DB is unavailable.
    """

    def __init__(self, database_url: str = None):
        self.database_url = database_url or os.getenv("DATABASE_URL", "")
        self.conn = None
        self._fallback_file = "trades_fallback.json"

        if self.database_url and HAS_PSYCOPG2:
            try:
                self.conn = psycopg2.connect(self.database_url)
                self.conn.autocommit = True
                logger.info("Connected to Postgres database")
            except Exception as e:
                logger.error(f"Failed to connect to database: {e}")
                logger.warning("Using local JSON fallback")
        else:
            if not HAS_PSYCOPG2:
                logger.warning("psycopg2 not installed, using local fallback")
            else:
                logger.warning("No DATABASE_URL set, using local fallback")

    def _execute(self, query: str, params: tuple = None) -> Optional[list]:
        """Execute a query and return results."""
        if not self.conn:
            return None
        try:
            with self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(query, params)
                if cur.description:
                    return cur.fetchall()
                return []
        except Exception as e:
            logger.error(f"Database query failed: {e}")
            try:
                self.conn.rollback()
            except Exception:
                pass
            return None

    def save_trade(self, trade: dict):
        """Save a completed trade."""
        if self.conn:
            self._execute(
                """INSERT INTO trades
                   (ts, exchange, symbol, side, qty, entry_price, exit_price,
                    fees, pnl, pnl_pct, kelly_fraction, strategy_tag, status, metadata)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    trade.get("ts", datetime.now(timezone.utc)),
                    trade.get("exchange", "kraken"),
                    trade["symbol"],
                    trade["side"],
                    trade["qty"],
                    trade["entry_price"],
                    trade.get("exit_price"),
                    trade.get("fees", 0),
                    trade.get("pnl"),
                    trade.get("pnl_pct"),
                    trade.get("kelly_fraction"),
                    trade.get("strategy_tag", "ema_crossover_trend"),
                    trade.get("status", "closed"),
                    json.dumps(trade.get("metadata", {})),
                ),
            )
        else:
            self._save_fallback("trade", trade)

    def save_equity_snapshot(
        self,
        equity: float,
        cash: float,
        unrealized_pnl: float,
        realized_pnl: float,
        total_fees: float,
    ):
        """Save an equity snapshot."""
        net_profit = realized_pnl - total_fees
        if self.conn:
            self._execute(
                """INSERT INTO equity_snapshots
                   (ts, equity, cash, unrealized_pnl, realized_pnl, total_fees, net_profit)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (
                    datetime.now(timezone.utc),
                    equity,
                    cash,
                    unrealized_pnl,
                    realized_pnl,
                    total_fees,
                    net_profit,
                ),
            )
        else:
            self._save_fallback("equity", {
                "equity": equity,
                "cash": cash,
                "unrealized_pnl": unrealized_pnl,
                "realized_pnl": realized_pnl,
                "total_fees": total_fees,
                "net_profit": net_profit,
            })

    def update_bot_status(
        self,
        status: str,
        mode: str,
        last_error: str = None,
        version: str = "1.0.0",
        config: dict = None,
        uptime_seconds: int = 0,
    ):
        """Update bot status heartbeat."""
        if self.conn:
            # Upsert: update if exists, insert if not
            self._execute(
                """INSERT INTO bot_status (id, ts, status, mode, last_heartbeat, last_error, version, config, uptime_seconds)
                   VALUES (1, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (id) DO UPDATE SET
                     ts = EXCLUDED.ts,
                     status = EXCLUDED.status,
                     mode = EXCLUDED.mode,
                     last_heartbeat = EXCLUDED.last_heartbeat,
                     last_error = EXCLUDED.last_error,
                     version = EXCLUDED.version,
                     config = EXCLUDED.config,
                     uptime_seconds = EXCLUDED.uptime_seconds""",
                (
                    datetime.now(timezone.utc),
                    status,
                    mode,
                    datetime.now(timezone.utc),
                    last_error,
                    version,
                    json.dumps(config or {}),
                    uptime_seconds,
                ),
            )

    def save_position(self, position: dict):
        """Save or update an open position."""
        if self.conn:
            self._execute(
                """INSERT INTO positions
                   (symbol, qty, side, avg_entry, current_price, unrealized_pnl,
                    stop_loss, trailing_stop, kelly_fraction, opened_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (symbol) DO UPDATE SET
                     qty = EXCLUDED.qty,
                     avg_entry = EXCLUDED.avg_entry,
                     current_price = EXCLUDED.current_price,
                     unrealized_pnl = EXCLUDED.unrealized_pnl,
                     stop_loss = EXCLUDED.stop_loss,
                     trailing_stop = EXCLUDED.trailing_stop,
                     kelly_fraction = EXCLUDED.kelly_fraction,
                     updated_at = EXCLUDED.updated_at""",
                (
                    position["symbol"],
                    position["qty"],
                    position.get("side", "long"),
                    position["avg_entry"],
                    position.get("current_price", 0),
                    position.get("unrealized_pnl", 0),
                    position.get("stop_loss", 0),
                    position.get("trailing_stop", 0),
                    position.get("kelly_fraction", 0),
                    position.get("opened_at", datetime.now(timezone.utc)),
                    datetime.now(timezone.utc),
                ),
            )

    def remove_position(self, symbol: str):
        """Remove a closed position."""
        if self.conn:
            self._execute("DELETE FROM positions WHERE symbol = %s", (symbol,))

    def save_kelly_stats(self, stats: dict):
        """Save Kelly criterion stats."""
        if self.conn:
            self._execute(
                """INSERT INTO kelly_stats
                   (ts, symbol, win_rate, avg_win, avg_loss, kelly_fraction, sample_size, period_days)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    datetime.now(timezone.utc),
                    stats.get("symbol", "all"),
                    stats["win_rate"],
                    stats["avg_win"],
                    stats["avg_loss"],
                    stats["kelly_fraction"],
                    stats["sample_size"],
                    stats.get("period_days", 90),
                ),
            )

    def get_trades(self, limit: int = 100, symbol: str = None) -> list:
        """Get recent trades."""
        if self.conn:
            if symbol:
                rows = self._execute(
                    "SELECT * FROM trades WHERE symbol = %s ORDER BY ts DESC LIMIT %s",
                    (symbol, limit),
                )
            else:
                rows = self._execute(
                    "SELECT * FROM trades ORDER BY ts DESC LIMIT %s", (limit,)
                )
            return [dict(r) for r in (rows or [])]
        return self._load_fallback("trade")

    def get_closed_trades(self, limit: int = 500) -> list:
        """Get closed trades for Kelly calculation."""
        if self.conn:
            rows = self._execute(
                "SELECT * FROM trades WHERE status = 'closed' ORDER BY ts DESC LIMIT %s",
                (limit,),
            )
            return [dict(r) for r in (rows or [])]
        return [t for t in self._load_fallback("trade") if t.get("status") == "closed"]

    def get_equity_history(self, limit: int = 1000) -> list:
        """Get equity snapshots."""
        if self.conn:
            rows = self._execute(
                "SELECT * FROM equity_snapshots ORDER BY ts DESC LIMIT %s", (limit,)
            )
            return [dict(r) for r in (rows or [])]
        return self._load_fallback("equity")

    def get_bot_status(self) -> Optional[dict]:
        """Get current bot status."""
        if self.conn:
            rows = self._execute(
                "SELECT * FROM bot_status WHERE id = 1"
            )
            return dict(rows[0]) if rows else None
        return None

    def get_positions(self) -> list:
        """Get all open positions."""
        if self.conn:
            rows = self._execute("SELECT * FROM positions ORDER BY symbol")
            return [dict(r) for r in (rows or [])]
        return []

    def get_total_fees(self) -> float:
        """Get total fees paid."""
        if self.conn:
            rows = self._execute("SELECT COALESCE(SUM(fees), 0) as total FROM trades")
            if rows:
                return float(rows[0]["total"])
        return 0.0

    def _save_fallback(self, record_type: str, data: dict):
        """Save to local JSON fallback."""
        import json
        from pathlib import Path
        fallback = Path(self._fallback_file)
        records = []
        if fallback.exists():
            try:
                records = json.loads(fallback.read_text())
            except Exception:
                pass
        data["_type"] = record_type
        data["_ts"] = datetime.now(timezone.utc).isoformat()
        records.append(data)
        fallback.write_text(json.dumps(records, indent=2, default=str))

    def _load_fallback(self, record_type: str) -> list:
        """Load from local JSON fallback."""
        import json
        from pathlib import Path
        fallback = Path(self._fallback_file)
        if not fallback.exists():
            return []
        try:
            records = json.loads(fallback.read_text())
            return [r for r in records if r.get("_type") == record_type]
        except Exception:
            return []

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
            logger.info("Database connection closed")
