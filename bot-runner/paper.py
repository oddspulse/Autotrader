"""Paper trading: simulated execution using real market data."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("autotrader.paper")


class PaperExchange:
    """
    Simulated exchange for paper trading.

    Uses real market data from Kraken but simulates order fills
    with configurable slippage.
    """

    def __init__(self, real_exchange, config: dict, initial_balance: float = 10000.0):
        self.real_exchange = real_exchange
        self.slippage_pct = config.get("execution", {}).get("slippage_pct", 0.001)
        self.taker_fee = 0.0026  # Kraken taker fee

        # Virtual balances
        self.balances = {"USD": initial_balance}
        self.orders = []
        self.trades = []

        logger.info(f"Paper exchange initialized with ${initial_balance:.2f}")

    def load_markets(self):
        """Delegate to real exchange."""
        self.real_exchange.load_markets()

    def check_time_sync(self, max_drift_ms: int = 5000) -> bool:
        """Delegate to real exchange."""
        return self.real_exchange.check_time_sync(max_drift_ms)

    def fetch_ohlcv(self, symbol: str, timeframe: str = "15m", limit: int = 250) -> list:
        """Delegate to real exchange for real market data."""
        return self.real_exchange.fetch_ohlcv(symbol, timeframe, limit)

    def fetch_ticker(self, symbol: str) -> dict:
        """Delegate to real exchange."""
        return self.real_exchange.fetch_ticker(symbol)

    def fetch_balance(self) -> dict:
        """Return simulated balance."""
        return {
            "total": dict(self.balances),
            "free": dict(self.balances),
            "used": {},
        }

    def get_total_equity(self) -> float:
        """Calculate total equity from virtual balances."""
        equity = 0.0
        for currency, amount in self.balances.items():
            if amount <= 0:
                continue
            if currency in ("USD", "USDT", "USDC"):
                equity += amount
            elif currency == "CAD":
                equity += amount * 0.74
            else:
                try:
                    ticker = self.real_exchange.fetch_ticker(f"{currency}/USD")
                    equity += amount * ticker["last"]
                except Exception:
                    try:
                        ticker = self.real_exchange.fetch_ticker(f"{currency}/USDT")
                        equity += amount * ticker["last"]
                    except Exception:
                        pass
        return equity

    def create_market_buy(self, symbol: str, amount: float) -> dict:
        """Simulate market buy with slippage."""
        ticker = self.real_exchange.fetch_ticker(symbol)
        price = ticker["ask"] * (1 + self.slippage_pct)  # Slippage on buy
        base, quote = symbol.split("/")
        cost = amount * price
        fee = cost * self.taker_fee

        # Check if we have enough quote currency
        available = self.balances.get(quote, 0)
        if available < cost + fee:
            raise Exception(
                f"Insufficient {quote}: need {cost + fee:.2f}, have {available:.2f}"
            )

        # Execute
        self.balances[quote] = available - cost - fee
        self.balances[base] = self.balances.get(base, 0) + amount

        order_id = str(uuid.uuid4())[:12]
        order = {
            "id": order_id,
            "symbol": symbol,
            "side": "buy",
            "type": "market",
            "amount": amount,
            "filled": amount,
            "price": price,
            "average": price,
            "cost": cost,
            "fee": {"cost": fee, "currency": quote},
            "status": "closed",
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
        }
        self.orders.append(order)
        logger.info(
            f"[PAPER] BUY {amount:.6f} {symbol} @ ${price:.2f} "
            f"(fee: ${fee:.4f})"
        )
        return order

    def create_market_sell(self, symbol: str, amount: float) -> dict:
        """Simulate market sell with slippage."""
        ticker = self.real_exchange.fetch_ticker(symbol)
        price = ticker["bid"] * (1 - self.slippage_pct)  # Slippage on sell
        base, quote = symbol.split("/")
        proceeds = amount * price
        fee = proceeds * self.taker_fee

        # Check if we have enough base currency
        available = self.balances.get(base, 0)
        if available < amount:
            raise Exception(
                f"Insufficient {base}: need {amount:.6f}, have {available:.6f}"
            )

        # Execute
        self.balances[base] = available - amount
        if self.balances[base] < 1e-10:
            del self.balances[base]
        self.balances[quote] = self.balances.get(quote, 0) + proceeds - fee

        order_id = str(uuid.uuid4())[:12]
        order = {
            "id": order_id,
            "symbol": symbol,
            "side": "sell",
            "type": "market",
            "amount": amount,
            "filled": amount,
            "price": price,
            "average": price,
            "cost": proceeds,
            "fee": {"cost": fee, "currency": quote},
            "status": "closed",
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
        }
        self.orders.append(order)
        logger.info(
            f"[PAPER] SELL {amount:.6f} {symbol} @ ${price:.2f} "
            f"(fee: ${fee:.4f})"
        )
        return order

    def create_limit_buy(self, symbol: str, amount: float, price: float) -> dict:
        """Simulate as market (paper mode doesn't wait for limit fills)."""
        return self.create_market_buy(symbol, amount)

    def create_limit_sell(self, symbol: str, amount: float, price: float) -> dict:
        """Simulate as market (paper mode doesn't wait for limit fills)."""
        return self.create_market_sell(symbol, amount)

    def fetch_open_orders(self, symbol: str = None) -> list:
        """No pending orders in paper mode (instant fills)."""
        return []

    def cancel_order(self, order_id: str, symbol: str) -> dict:
        """No-op in paper mode."""
        return {"id": order_id, "status": "cancelled"}

    def fetch_my_trades(self, symbol: str = None, limit: int = 50) -> list:
        """Return simulated trades."""
        trades = self.orders[-limit:]
        if symbol:
            trades = [t for t in trades if t["symbol"] == symbol]
        return trades

    def get_trading_fees(self, symbol: str) -> dict:
        """Return Kraken-equivalent fees."""
        return {"maker": 0.0016, "taker": self.taker_fee}

    def get_min_order_size(self, symbol: str) -> float:
        """Delegate to real exchange."""
        return self.real_exchange.get_min_order_size(symbol)

    def fetch_order_book(self, symbol: str, limit: int = 10) -> dict:
        """Delegate to real exchange."""
        return self.real_exchange.fetch_order_book(symbol, limit)

    def get_24h_volume(self, symbol: str) -> float:
        """Delegate to real exchange."""
        return self.real_exchange.get_24h_volume(symbol)
