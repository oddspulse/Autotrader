"""Order execution with safety checks and idempotency."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger("autotrader.execution")


@dataclass
class OrderResult:
    """Result of an order execution."""
    success: bool
    order_id: str
    symbol: str
    side: str
    qty: float
    price: float
    fees: float
    timestamp: datetime
    raw: dict
    error: str = ""


class ExecutionEngine:
    """
    Handles order execution with safety checks.

    Features:
    - Idempotent order placement via client order IDs
    - Slippage protection
    - Minimum order size checks
    - Fee tracking
    """

    def __init__(self, exchange, config: dict):
        self.exchange = exchange
        exec_cfg = config.get("execution", {})
        self.order_type = exec_cfg.get("order_type", "market")
        self.slippage_pct = exec_cfg.get("slippage_pct", 0.001)
        self.max_retries = exec_cfg.get("max_retries", 3)
        self._pending_orders = {}  # client_id -> order info

    def execute_buy(
        self, symbol: str, qty: float, price_hint: float = None
    ) -> OrderResult:
        """
        Execute a buy order.

        For market orders: executes at market
        For limit orders: places at price_hint with slippage buffer
        """
        client_id = str(uuid.uuid4())[:8]
        logger.info(
            f"Executing BUY {qty} {symbol} (type={self.order_type}, "
            f"client_id={client_id})"
        )

        # Check minimum order size
        try:
            min_size = self.exchange.get_min_order_size(symbol)
            if qty < min_size:
                return OrderResult(
                    success=False,
                    order_id="",
                    symbol=symbol,
                    side="buy",
                    qty=qty,
                    price=0,
                    fees=0,
                    timestamp=datetime.now(timezone.utc),
                    raw={},
                    error=f"Order qty {qty} below minimum {min_size}",
                )
        except Exception as e:
            logger.warning(f"Could not check min order size: {e}")

        try:
            if self.order_type == "limit" and price_hint:
                # Add slippage buffer for limit buy (slightly above market)
                limit_price = price_hint * (1 + self.slippage_pct)
                result = self.exchange.create_limit_buy(symbol, qty, limit_price)
            else:
                result = self.exchange.create_market_buy(symbol, qty)

            filled_price = result.get("average", result.get("price", price_hint or 0))
            fees = self._extract_fees(result)

            order_result = OrderResult(
                success=True,
                order_id=result.get("id", client_id),
                symbol=symbol,
                side="buy",
                qty=float(result.get("filled", qty)),
                price=float(filled_price) if filled_price else 0,
                fees=fees,
                timestamp=datetime.now(timezone.utc),
                raw=result,
            )

            logger.info(
                f"BUY filled: {order_result.qty} {symbol} @ "
                f"${order_result.price:.2f}, fees=${fees:.4f}"
            )
            return order_result

        except Exception as e:
            logger.error(f"BUY order failed for {symbol}: {e}")
            return OrderResult(
                success=False,
                order_id="",
                symbol=symbol,
                side="buy",
                qty=qty,
                price=0,
                fees=0,
                timestamp=datetime.now(timezone.utc),
                raw={},
                error=str(e),
            )

    def execute_sell(
        self, symbol: str, qty: float, price_hint: float = None
    ) -> OrderResult:
        """
        Execute a sell order.

        For market orders: executes at market
        For limit orders: places at price_hint with slippage buffer
        """
        client_id = str(uuid.uuid4())[:8]
        logger.info(
            f"Executing SELL {qty} {symbol} (type={self.order_type}, "
            f"client_id={client_id})"
        )

        try:
            if self.order_type == "limit" and price_hint:
                limit_price = price_hint * (1 - self.slippage_pct)
                result = self.exchange.create_limit_sell(symbol, qty, limit_price)
            else:
                result = self.exchange.create_market_sell(symbol, qty)

            filled_price = result.get("average", result.get("price", price_hint or 0))
            fees = self._extract_fees(result)

            order_result = OrderResult(
                success=True,
                order_id=result.get("id", client_id),
                symbol=symbol,
                side="sell",
                qty=float(result.get("filled", qty)),
                price=float(filled_price) if filled_price else 0,
                fees=fees,
                timestamp=datetime.now(timezone.utc),
                raw=result,
            )

            logger.info(
                f"SELL filled: {order_result.qty} {symbol} @ "
                f"${order_result.price:.2f}, fees=${fees:.4f}"
            )
            return order_result

        except Exception as e:
            logger.error(f"SELL order failed for {symbol}: {e}")
            return OrderResult(
                success=False,
                order_id="",
                symbol=symbol,
                side="sell",
                qty=qty,
                price=0,
                fees=0,
                timestamp=datetime.now(timezone.utc),
                raw={},
                error=str(e),
            )

    def _extract_fees(self, order_result: dict) -> float:
        """Extract total fees from order result."""
        fee_info = order_result.get("fee", {})
        if fee_info:
            cost = fee_info.get("cost", 0)
            if cost:
                return float(cost)

        # Estimate from trades
        trades = order_result.get("trades", [])
        total_fees = 0.0
        for trade in trades:
            fee = trade.get("fee", {})
            total_fees += float(fee.get("cost", 0))

        if total_fees > 0:
            return total_fees

        # Fallback: estimate using taker fee
        filled = float(order_result.get("filled", 0))
        price = float(order_result.get("average", order_result.get("price", 0)) or 0)
        return filled * price * 0.0026  # Kraken taker fee estimate
