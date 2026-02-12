"""Portfolio tracking: positions, equity, P&L."""

import logging
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("autotrader.portfolio")


@dataclass
class Position:
    """An open position."""
    symbol: str
    qty: float
    side: str  # "long" for spot
    avg_entry: float
    current_price: float = 0.0
    unrealized_pnl: float = 0.0
    stop_loss: float = 0.0
    trailing_stop: float = 0.0
    highest_price: float = 0.0
    kelly_fraction: float = 0.0
    opened_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def update_price(self, price: float):
        """Update current price and unrealized PnL."""
        self.current_price = price
        self.unrealized_pnl = (price - self.avg_entry) * self.qty
        if price > self.highest_price:
            self.highest_price = price
        self.updated_at = datetime.now(timezone.utc)

    def unrealized_pnl_pct(self) -> float:
        """Get unrealized PnL as percentage."""
        if self.avg_entry == 0:
            return 0.0
        return (self.current_price - self.avg_entry) / self.avg_entry

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "qty": self.qty,
            "side": self.side,
            "avg_entry": self.avg_entry,
            "current_price": self.current_price,
            "unrealized_pnl": self.unrealized_pnl,
            "stop_loss": self.stop_loss,
            "trailing_stop": self.trailing_stop,
            "highest_price": self.highest_price,
            "kelly_fraction": self.kelly_fraction,
            "opened_at": self.opened_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class Portfolio:
    """
    Portfolio tracker.

    Manages open positions and calculates equity.
    For spot-only trading, all positions are 'long'.
    """

    def __init__(self):
        self.positions: dict[str, Position] = {}
        self.cash: float = 0.0
        self.total_fees: float = 0.0
        self.realized_pnl: float = 0.0

    def set_cash(self, cash: float):
        """Set cash balance."""
        self.cash = cash

    def open_position(
        self,
        symbol: str,
        qty: float,
        entry_price: float,
        stop_loss: float = 0.0,
        kelly_fraction: float = 0.0,
        fees: float = 0.0,
    ) -> Position:
        """Open a new position."""
        if symbol in self.positions:
            # Add to existing position (average in)
            pos = self.positions[symbol]
            total_cost = (pos.avg_entry * pos.qty) + (entry_price * qty)
            pos.qty += qty
            pos.avg_entry = total_cost / pos.qty
            pos.stop_loss = stop_loss if stop_loss else pos.stop_loss
            pos.updated_at = datetime.now(timezone.utc)
            logger.info(f"Added to position {symbol}: +{qty} @ {entry_price}")
        else:
            pos = Position(
                symbol=symbol,
                qty=qty,
                side="long",
                avg_entry=entry_price,
                current_price=entry_price,
                stop_loss=stop_loss,
                highest_price=entry_price,
                kelly_fraction=kelly_fraction,
            )
            self.positions[symbol] = pos
            logger.info(
                f"Opened position {symbol}: {qty} @ {entry_price}, "
                f"stop={stop_loss:.2f}, kelly={kelly_fraction:.4f}"
            )

        self.total_fees += fees
        cost = qty * entry_price + fees
        self.cash -= cost

        return pos

    def close_position(
        self, symbol: str, exit_price: float, fees: float = 0.0
    ) -> Optional[dict]:
        """Close a position and return trade summary."""
        if symbol not in self.positions:
            logger.warning(f"No position to close for {symbol}")
            return None

        pos = self.positions[symbol]
        pnl = (exit_price - pos.avg_entry) * pos.qty
        pnl_pct = (exit_price - pos.avg_entry) / pos.avg_entry if pos.avg_entry > 0 else 0

        proceeds = pos.qty * exit_price - fees
        self.cash += proceeds
        self.total_fees += fees
        self.realized_pnl += pnl - fees

        trade_summary = {
            "symbol": symbol,
            "side": "sell",
            "qty": pos.qty,
            "entry_price": pos.avg_entry,
            "exit_price": exit_price,
            "pnl": pnl - fees,
            "pnl_pct": pnl_pct,
            "fees": fees,
            "kelly_fraction": pos.kelly_fraction,
            "held_seconds": (
                datetime.now(timezone.utc) - pos.opened_at
            ).total_seconds(),
        }

        logger.info(
            f"Closed position {symbol}: {pos.qty} @ {exit_price}, "
            f"PnL=${pnl - fees:.2f} ({pnl_pct:.2%})"
        )

        del self.positions[symbol]
        return trade_summary

    def update_prices(self, prices: dict[str, float]):
        """Update all position prices."""
        for symbol, price in prices.items():
            if symbol in self.positions:
                self.positions[symbol].update_price(price)

    def get_equity(self) -> float:
        """Get total equity (cash + unrealized)."""
        unrealized = sum(
            pos.current_price * pos.qty for pos in self.positions.values()
        )
        return self.cash + unrealized

    def get_unrealized_pnl(self) -> float:
        """Get total unrealized PnL."""
        return sum(pos.unrealized_pnl for pos in self.positions.values())

    def get_position_count(self) -> int:
        """Get number of open positions."""
        return len(self.positions)

    def has_position(self, symbol: str) -> bool:
        """Check if symbol has an open position."""
        return symbol in self.positions

    def get_position(self, symbol: str) -> Optional[Position]:
        """Get position for a symbol."""
        return self.positions.get(symbol)

    def check_stops(self, prices: dict[str, float]) -> list[str]:
        """
        Check all positions against their stop losses.
        Returns list of symbols that hit their stops.
        """
        stopped_out = []
        for symbol, pos in list(self.positions.items()):
            price = prices.get(symbol, pos.current_price)
            pos.update_price(price)

            # Check initial stop loss
            if pos.stop_loss > 0 and price <= pos.stop_loss:
                logger.warning(
                    f"STOP LOSS hit for {symbol}: price={price} <= stop={pos.stop_loss}"
                )
                stopped_out.append(symbol)
                continue

            # Check trailing stop
            if pos.trailing_stop > 0 and price <= pos.trailing_stop:
                logger.warning(
                    f"TRAILING STOP hit for {symbol}: price={price} <= "
                    f"trail={pos.trailing_stop}"
                )
                stopped_out.append(symbol)

        return stopped_out

    def update_trailing_stops(self, strategy):
        """Update trailing stops for positions in profit."""
        for symbol, pos in self.positions.items():
            if pos.current_price > pos.avg_entry:
                # Position is in profit, update trailing stop
                new_trail = strategy.get_trailing_stop(
                    pos.highest_price, pos.stop_loss  # Use ATR from initial stop calc
                )
                if new_trail > pos.trailing_stop:
                    pos.trailing_stop = new_trail
                    logger.debug(
                        f"Updated trailing stop for {symbol}: {pos.trailing_stop:.2f}"
                    )

    def to_dict(self) -> dict:
        """Serialize portfolio state."""
        return {
            "cash": self.cash,
            "equity": self.get_equity(),
            "unrealized_pnl": self.get_unrealized_pnl(),
            "realized_pnl": self.realized_pnl,
            "total_fees": self.total_fees,
            "position_count": self.get_position_count(),
            "positions": {
                s: p.to_dict() for s, p in self.positions.items()
            },
        }
