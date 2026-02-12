"""Kraken exchange interface via ccxt."""

import ccxt
import time
import logging
from typing import Optional
from utils import retry_with_backoff, now_utc

logger = logging.getLogger("autotrader.exchange")


class KrakenExchange:
    """Wrapper around ccxt Kraken for spot trading."""

    def __init__(self, config: dict):
        self.config = config
        exchange_cfg = config.get("exchange", {})

        self.exchange = ccxt.kraken({
            "apiKey": config.get("api_key", ""),
            "secret": config.get("api_secret", ""),
            "enableRateLimit": exchange_cfg.get("rate_limit", True),
            "timeout": exchange_cfg.get("timeout", 30000),
            "options": {
                "defaultType": "spot",
            },
        })

        if exchange_cfg.get("sandbox", False):
            self.exchange.set_sandbox_mode(True)

        self._last_time_check = 0
        self._markets_loaded = False

    def load_markets(self):
        """Load exchange markets."""
        if not self._markets_loaded:
            retry_with_backoff(lambda: self.exchange.load_markets())
            self._markets_loaded = True
            logger.info(f"Loaded {len(self.exchange.markets)} markets from Kraken")

    def check_time_sync(self, max_drift_ms: int = 5000) -> bool:
        """Verify local clock is synced with exchange."""
        try:
            server_time = self.exchange.fetch_time()
            local_time = int(time.time() * 1000)
            drift = abs(server_time - local_time)
            if drift > max_drift_ms:
                logger.error(
                    f"Time drift too large: {drift}ms (max {max_drift_ms}ms)"
                )
                return False
            logger.debug(f"Time sync OK, drift: {drift}ms")
            return True
        except Exception as e:
            logger.error(f"Time sync check failed: {e}")
            return False

    def fetch_ohlcv(
        self, symbol: str, timeframe: str = "15m", limit: int = 250
    ) -> list:
        """Fetch OHLCV candles."""
        self.load_markets()

        def _fetch():
            return self.exchange.fetch_ohlcv(
                symbol, timeframe=timeframe, limit=limit
            )

        candles = retry_with_backoff(_fetch)
        logger.debug(f"Fetched {len(candles)} candles for {symbol} {timeframe}")
        return candles

    def fetch_ticker(self, symbol: str) -> dict:
        """Fetch current ticker."""
        self.load_markets()
        return retry_with_backoff(lambda: self.exchange.fetch_ticker(symbol))

    def fetch_balance(self) -> dict:
        """Fetch account balance."""
        return retry_with_backoff(lambda: self.exchange.fetch_balance())

    def get_total_equity(self) -> float:
        """Get total account equity in USD equivalent."""
        balance = self.fetch_balance()
        total = balance.get("total", {})

        equity = 0.0
        # Sum USD-like balances directly
        for currency in ["USD", "USDT", "USDC"]:
            equity += float(total.get(currency, 0))

        # Convert CAD to USD (approximate)
        cad = float(total.get("CAD", 0))
        if cad > 0:
            try:
                ticker = self.fetch_ticker("USD/CAD")
                equity += cad / ticker["last"]
            except Exception:
                equity += cad * 0.74  # fallback

        # Add value of crypto holdings
        for currency, amount in total.items():
            amount = float(amount)
            if amount > 0 and currency not in ["USD", "USDT", "USDC", "CAD"]:
                try:
                    ticker = self.fetch_ticker(f"{currency}/USD")
                    equity += amount * ticker["last"]
                except Exception:
                    try:
                        ticker = self.fetch_ticker(f"{currency}/USDT")
                        equity += amount * ticker["last"]
                    except Exception:
                        logger.warning(
                            f"Could not price {currency}, skipping"
                        )
        return equity

    def create_market_buy(
        self, symbol: str, amount: float
    ) -> dict:
        """Place a market buy order."""
        logger.info(f"MARKET BUY {amount} {symbol}")
        return retry_with_backoff(
            lambda: self.exchange.create_market_buy_order(symbol, amount)
        )

    def create_market_sell(
        self, symbol: str, amount: float
    ) -> dict:
        """Place a market sell order."""
        logger.info(f"MARKET SELL {amount} {symbol}")
        return retry_with_backoff(
            lambda: self.exchange.create_market_sell_order(symbol, amount)
        )

    def create_limit_buy(
        self, symbol: str, amount: float, price: float
    ) -> dict:
        """Place a limit buy order."""
        logger.info(f"LIMIT BUY {amount} {symbol} @ {price}")
        return retry_with_backoff(
            lambda: self.exchange.create_limit_buy_order(symbol, amount, price)
        )

    def create_limit_sell(
        self, symbol: str, amount: float, price: float
    ) -> dict:
        """Place a limit sell order."""
        logger.info(f"LIMIT SELL {amount} {symbol} @ {price}")
        return retry_with_backoff(
            lambda: self.exchange.create_limit_sell_order(symbol, amount, price)
        )

    def fetch_open_orders(self, symbol: Optional[str] = None) -> list:
        """Fetch open orders."""
        return retry_with_backoff(
            lambda: self.exchange.fetch_open_orders(symbol)
        )

    def cancel_order(self, order_id: str, symbol: str) -> dict:
        """Cancel an order."""
        logger.info(f"CANCEL order {order_id} on {symbol}")
        return retry_with_backoff(
            lambda: self.exchange.cancel_order(order_id, symbol)
        )

    def fetch_my_trades(
        self, symbol: Optional[str] = None, limit: int = 50
    ) -> list:
        """Fetch recent trades."""
        return retry_with_backoff(
            lambda: self.exchange.fetch_my_trades(symbol, limit=limit)
        )

    def get_trading_fees(self, symbol: str) -> dict:
        """Get trading fees for a symbol."""
        try:
            self.load_markets()
            market = self.exchange.market(symbol)
            return {
                "maker": market.get("maker", 0.0016),
                "taker": market.get("taker", 0.0026),
            }
        except Exception:
            return {"maker": 0.0016, "taker": 0.0026}

    def get_min_order_size(self, symbol: str) -> float:
        """Get minimum order size for a symbol."""
        self.load_markets()
        market = self.exchange.market(symbol)
        limits = market.get("limits", {}).get("amount", {})
        return float(limits.get("min", 0))

    def fetch_order_book(self, symbol: str, limit: int = 10) -> dict:
        """Fetch order book for liquidity checks."""
        return retry_with_backoff(
            lambda: self.exchange.fetch_order_book(symbol, limit)
        )

    def get_24h_volume(self, symbol: str) -> float:
        """Get 24h volume in quote currency."""
        ticker = self.fetch_ticker(symbol)
        return float(ticker.get("quoteVolume", 0))
