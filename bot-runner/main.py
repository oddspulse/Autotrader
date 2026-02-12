"""
Autotrader Bot Runner - Main Loop

Fully automated crypto trading bot for Kraken spot markets.
Uses Kelly criterion for position sizing ("profit or not survive" model).

Usage:
    python main.py                  # Run with config.yaml (default paper mode)
    python main.py --live           # Run in live trading mode
    python main.py --backtest       # Run backtest
    python main.py --config path    # Custom config file
"""

import os
import sys
import time
import signal
import argparse
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

from utils import setup_logging, load_config, validate_config, sleep_until_next_candle, now_utc
from exchange import KrakenExchange
from paper import PaperExchange
from strategy import EMACrossoverStrategy
from kelly import KellyCriterion
from risk import RiskManager
from execution import ExecutionEngine
from portfolio import Portfolio
from storage import Storage
from metrics import MetricsCalculator
from monitoring import TelegramAlert, Heartbeat
from backtest import BacktestEngine

logger = setup_logging(os.getenv("LOG_LEVEL", "INFO"))

# Graceful shutdown
_shutdown = False


def shutdown_handler(signum, frame):
    global _shutdown
    logger.info("Shutdown signal received, stopping gracefully...")
    _shutdown = True


signal.signal(signal.SIGINT, shutdown_handler)
signal.signal(signal.SIGTERM, shutdown_handler)


def run_backtest(config: dict):
    """Run backtesting mode."""
    logger.info("=== BACKTEST MODE ===")

    # Initialize real exchange for historical data (no API key needed for public data)
    exchange = KrakenExchange(config)
    engine = BacktestEngine(config)

    candles_by_symbol = {}
    for pair in config.get("pairs", []):
        try:
            logger.info(f"Fetching historical data for {pair}...")
            candles = exchange.fetch_ohlcv(pair, config.get("timeframe", "15m"), limit=1000)
            if candles:
                candles_by_symbol[pair] = candles
                logger.info(f"  Got {len(candles)} candles for {pair}")
        except Exception as e:
            logger.warning(f"  Could not fetch {pair}: {e}")

    if not candles_by_symbol:
        logger.error("No data fetched for any pair")
        return

    results = engine.run_multi(candles_by_symbol)
    engine.save_results(results)

    # Print summary
    agg = results.get("aggregate", {})
    print("\n" + "=" * 60)
    print("BACKTEST RESULTS")
    print("=" * 60)
    print(f"Symbols tested: {', '.join(results.get('symbols_tested', []))}")
    print(f"Total trades: {agg.get('total_trades', 0)}")
    print(f"Win rate: {agg.get('win_rate', 0):.1%}")
    print(f"Net PnL: ${agg.get('net_pnl', 0):,.2f}")
    print(f"Profit factor: {agg.get('profit_factor', 0):.2f}")
    print(f"Avg win: ${agg.get('avg_win', 0):,.2f}")
    print(f"Avg loss: ${agg.get('avg_loss', 0):,.2f}")
    print("=" * 60)

    for sym, r in results.get("per_symbol", {}).items():
        print(f"\n{sym}: return={r.get('total_return', 0):.2%}, "
              f"trades={r.get('closed_trades', 0)}")


def run_trading(config: dict, live: bool = False):
    """
    Main trading loop.

    Runs continuously, checking for signals at each candle close.
    """
    mode = "live" if live else "paper"
    logger.info(f"=== {'LIVE' if live else 'PAPER'} TRADING MODE ===")

    if live and not os.getenv("KRAKEN_API_KEY"):
        logger.error("KRAKEN_API_KEY not set. Cannot run live trading.")
        sys.exit(1)

    # Initialize components
    config["api_key"] = os.getenv("KRAKEN_API_KEY", "")
    config["api_secret"] = os.getenv("KRAKEN_API_SECRET", "")

    real_exchange = KrakenExchange(config)

    if live:
        exchange = real_exchange
    else:
        initial_balance = float(os.getenv("PAPER_INITIAL_BALANCE", "10000"))
        exchange = PaperExchange(real_exchange, config, initial_balance)

    strategy = EMACrossoverStrategy(config)
    kelly = KellyCriterion(config)
    risk_mgr = RiskManager(config)
    executor = ExecutionEngine(exchange, config)
    portfolio = Portfolio()
    storage = Storage(os.getenv("DATABASE_URL"))
    metrics = MetricsCalculator(config)
    telegram = TelegramAlert()
    heartbeat = Heartbeat(storage, config.get("monitoring", {}).get("heartbeat_interval", 60))

    pairs = config.get("pairs", [])
    timeframe = config.get("timeframe", "15m")
    start_time = now_utc()

    # Pre-flight checks
    logger.info("Running pre-flight checks...")

    if not exchange.check_time_sync():
        logger.error("Time sync failed - aborting")
        telegram.send_error_alert("Bot startup failed: time sync error")
        sys.exit(1)

    exchange.load_markets()

    # Validate pairs
    valid_pairs = []
    for pair in pairs:
        try:
            ticker = exchange.fetch_ticker(pair)
            if ticker:
                valid_pairs.append(pair)
                logger.info(f"  {pair}: OK (price=${ticker['last']:,.2f})")
        except Exception as e:
            logger.warning(f"  {pair}: SKIPPED ({e})")

    if not valid_pairs:
        logger.error("No valid pairs found")
        sys.exit(1)

    pairs = valid_pairs
    logger.info(f"Trading {len(pairs)} pairs: {', '.join(pairs)}")

    # Initialize portfolio with current balance
    try:
        equity = exchange.get_total_equity()
        portfolio.set_cash(equity)
        risk_mgr.state.peak_equity = equity
        logger.info(f"Starting equity: ${equity:,.2f}")
    except Exception as e:
        logger.warning(f"Could not fetch initial equity: {e}")
        if not live:
            equity = float(os.getenv("PAPER_INITIAL_BALANCE", "10000"))
            portfolio.set_cash(equity)
            risk_mgr.state.peak_equity = equity

    # Start heartbeat
    heartbeat.start(mode=mode)
    telegram.send_startup_alert(mode, pairs)

    # Save initial status
    storage.update_bot_status(
        status="running",
        mode=mode,
        version="1.0.0",
        config={k: v for k, v in config.items() if k not in ("api_key", "api_secret")},
    )

    # Track daily summary hour
    last_daily_summary_day = None
    daily_summary_hour = config.get("monitoring", {}).get("daily_summary_hour", 0)

    logger.info(f"Bot started. Waiting for candle closes on {timeframe} timeframe...")

    # Main loop
    cycle_count = 0
    while not _shutdown:
        cycle_count += 1
        cycle_start = time.time()

        try:
            logger.info(f"--- Cycle {cycle_count} at {now_utc().strftime('%H:%M:%S UTC')} ---")

            # Update equity
            try:
                equity = exchange.get_total_equity()
                portfolio.set_cash(equity - sum(
                    p.current_price * p.qty for p in portfolio.positions.values()
                ))
                risk_mgr.update_equity(equity)
                risk_mgr.record_api_success()
            except Exception as e:
                logger.error(f"Failed to fetch equity: {e}")
                risk_mgr.record_api_failure()
                if risk_mgr.state.circuit_breaker_active:
                    telegram.send_kill_switch_alert("Circuit breaker: API failures")
                    _wait_or_shutdown(60)
                    continue

            # Check kill switches
            if risk_mgr.state.trading_halted:
                logger.warning(f"Trading halted: {risk_mgr.state.halt_reason}")
                heartbeat.beat(status="halted", error=risk_mgr.state.halt_reason)
                _wait_or_shutdown(60)
                continue

            # Fetch prices and check stops
            prices = {}
            for pair in pairs:
                try:
                    ticker = exchange.fetch_ticker(pair)
                    prices[pair] = ticker["last"]
                except Exception as e:
                    logger.warning(f"Could not fetch price for {pair}: {e}")

            portfolio.update_prices(prices)
            risk_mgr.update_position_count(portfolio.get_position_count())

            # Check stop losses
            stopped = portfolio.check_stops(prices)
            for symbol in stopped:
                price = prices.get(symbol, 0)
                if price > 0:
                    result = executor.execute_sell(symbol, portfolio.positions[symbol].qty, price)
                    if result.success:
                        trade = portfolio.close_position(symbol, result.price, result.fees)
                        if trade:
                            trade["ts"] = now_utc()
                            trade["exchange"] = "kraken"
                            trade["status"] = "closed"
                            storage.save_trade(trade)
                            storage.remove_position(symbol)
                            if config.get("monitoring", {}).get("alert_on_trade", True):
                                telegram.send_trade_alert(trade)
                            risk_mgr.set_cooldown(symbol)
                    else:
                        logger.error(f"Failed to execute stop for {symbol}: {result.error}")
                        telegram.send_error_alert(f"Stop execution failed for {symbol}: {result.error}")

            # Process each pair for signals
            for pair in pairs:
                if _shutdown:
                    break

                try:
                    # Fetch candles
                    candles = exchange.fetch_ohlcv(pair, timeframe, limit=250)
                    if not candles or len(candles) < 210:
                        logger.debug(f"{pair}: Not enough candle data ({len(candles) if candles else 0})")
                        continue

                    has_pos = portfolio.has_position(pair)
                    signal = strategy.generate_signal(pair, candles, has_pos)

                    if signal.direction == "none":
                        logger.debug(f"{pair}: {signal.reason}")
                        continue

                    # BUY signal
                    if signal.direction == "buy":
                        # Pre-trade risk check
                        volume = exchange.get_24h_volume(pair)
                        can_trade, reason = risk_mgr.pre_trade_check(pair, volume)
                        if not can_trade:
                            logger.info(f"{pair}: Skipped buy - {reason}")
                            continue

                        # Kelly position sizing
                        closed_trades = storage.get_closed_trades(limit=200)
                        kelly_result = kelly.calculate_for_symbol(closed_trades, pair)
                        fraction = kelly_result.fraction

                        logger.info(f"{pair}: {kelly_result.reason}")

                        if fraction <= 0:
                            logger.info(f"{pair}: Kelly says don't trade (fraction={fraction})")
                            continue

                        # Calculate position size
                        position_value = equity * fraction
                        qty = position_value / signal.entry_price
                        min_size = exchange.get_min_order_size(pair)
                        if qty < min_size:
                            logger.info(f"{pair}: Position too small ({qty} < {min_size})")
                            continue

                        # Execute buy
                        result = executor.execute_buy(pair, qty, signal.entry_price)
                        if result.success:
                            pos = portfolio.open_position(
                                symbol=pair,
                                qty=result.qty,
                                entry_price=result.price,
                                stop_loss=signal.stop_loss,
                                kelly_fraction=fraction,
                                fees=result.fees,
                            )
                            storage.save_position(pos.to_dict())
                            storage.save_trade({
                                "ts": now_utc(),
                                "exchange": "kraken",
                                "symbol": pair,
                                "side": "buy",
                                "qty": result.qty,
                                "entry_price": result.price,
                                "exit_price": None,
                                "fees": result.fees,
                                "pnl": None,
                                "pnl_pct": None,
                                "kelly_fraction": fraction,
                                "status": "open",
                            })

                            # Save Kelly stats
                            storage.save_kelly_stats({
                                "symbol": pair,
                                "win_rate": kelly_result.win_rate,
                                "avg_win": kelly_result.avg_win,
                                "avg_loss": kelly_result.avg_loss,
                                "kelly_fraction": fraction,
                                "sample_size": kelly_result.sample_size,
                            })

                            if config.get("monitoring", {}).get("alert_on_trade", True):
                                telegram.send_trade_alert({
                                    "symbol": pair,
                                    "side": "buy",
                                    "qty": result.qty,
                                    "entry_price": result.price,
                                    "exit_price": 0,
                                    "pnl": 0,
                                    "pnl_pct": 0,
                                    "fees": result.fees,
                                    "kelly_fraction": fraction,
                                })

                            risk_mgr.record_api_success()
                        else:
                            logger.error(f"{pair}: Buy failed - {result.error}")
                            risk_mgr.record_api_failure()

                    # SELL signal (exit)
                    elif signal.direction == "sell" and has_pos:
                        pos = portfolio.get_position(pair)
                        result = executor.execute_sell(pair, pos.qty, signal.entry_price)
                        if result.success:
                            trade = portfolio.close_position(pair, result.price, result.fees)
                            if trade:
                                trade["ts"] = now_utc()
                                trade["exchange"] = "kraken"
                                trade["status"] = "closed"
                                storage.save_trade(trade)
                                storage.remove_position(pair)
                                if config.get("monitoring", {}).get("alert_on_trade", True):
                                    telegram.send_trade_alert(trade)
                            risk_mgr.record_api_success()
                        else:
                            logger.error(f"{pair}: Sell failed - {result.error}")
                            risk_mgr.record_api_failure()

                except Exception as e:
                    logger.error(f"Error processing {pair}: {e}", exc_info=True)
                    risk_mgr.record_api_failure()

            # Update trailing stops
            for sym, pos in list(portfolio.positions.items()):
                if pos.current_price > pos.avg_entry and pos.stop_loss > 0:
                    atr_est = (pos.avg_entry - pos.stop_loss) / strategy.stop_atr_mult
                    new_trail = strategy.get_trailing_stop(pos.highest_price, atr_est)
                    if new_trail > pos.trailing_stop:
                        pos.trailing_stop = new_trail
                        storage.save_position(pos.to_dict())

            # Snapshot equity
            storage.save_equity_snapshot(
                equity=portfolio.get_equity(),
                cash=portfolio.cash,
                unrealized_pnl=portfolio.get_unrealized_pnl(),
                realized_pnl=portfolio.realized_pnl,
                total_fees=portfolio.total_fees,
            )

            # Daily summary check
            now = now_utc()
            if (now.hour == daily_summary_hour and
                    last_daily_summary_day != now.date()):
                last_daily_summary_day = now.date()
                all_trades = storage.get_closed_trades(limit=500)
                summary = metrics.compute_daily_summary(all_trades, portfolio.get_equity())
                telegram.send_daily_summary(summary)

                # Sustainability report
                sustainability = metrics.compute_sustainability(all_trades, start_time)
                telegram.send_sustainability_report(sustainability)

            # Heartbeat
            heartbeat.beat(status="running")

            # Log cycle info
            cycle_time = time.time() - cycle_start
            logger.info(
                f"Cycle {cycle_count} complete in {cycle_time:.1f}s | "
                f"Equity: ${portfolio.get_equity():,.2f} | "
                f"Positions: {portfolio.get_position_count()}/{risk_mgr.max_positions} | "
                f"Daily PnL: {risk_mgr.state.daily_pnl:.2%} | "
                f"DD: {risk_mgr.state.current_drawdown:.2%}"
            )

        except Exception as e:
            logger.error(f"Cycle error: {e}", exc_info=True)
            telegram.send_error_alert(f"Cycle error: {str(e)[:200]}")
            risk_mgr.record_api_failure()

        # Wait for next candle
        wait_time = sleep_until_next_candle(timeframe)
        logger.info(f"Sleeping {wait_time:.0f}s until next candle...")
        _wait_or_shutdown(wait_time)

    # Shutdown
    logger.info("Shutting down...")
    heartbeat.stop()
    storage.update_bot_status(status="stopped", mode=mode)
    storage.close()
    telegram.send(f"🛑 Bot stopped ({mode} mode)")
    logger.info("Bot stopped cleanly.")


def _wait_or_shutdown(seconds: float):
    """Sleep but wake up on shutdown signal."""
    end = time.time() + seconds
    while time.time() < end and not _shutdown:
        time.sleep(min(1.0, end - time.time()))


def main():
    parser = argparse.ArgumentParser(description="Autotrader Bot Runner")
    parser.add_argument("--config", default=None, help="Path to config.yaml")
    parser.add_argument("--live", action="store_true", help="Run in live trading mode")
    parser.add_argument("--backtest", action="store_true", help="Run backtest")
    parser.add_argument("--paper", action="store_true", help="Run in paper trading mode (default)")
    args = parser.parse_args()

    config = load_config(args.config)

    # Validate config
    errors = validate_config(config)
    if errors:
        for err in errors:
            logger.error(f"Config error: {err}")
        sys.exit(1)

    logger.info("Configuration loaded and validated")
    logger.info(f"Pairs: {config.get('pairs', [])}")
    logger.info(f"Timeframe: {config.get('timeframe')}")
    logger.info(f"Kelly multiplier: {config.get('risk', {}).get('kelly_fraction', 1.0)}x")

    if args.backtest:
        run_backtest(config)
    elif args.live:
        logger.warning("=" * 60)
        logger.warning("  LIVE TRADING MODE - REAL MONEY AT RISK")
        logger.warning("  Full Kelly criterion - aggressive sizing")
        logger.warning("=" * 60)
        run_trading(config, live=True)
    else:
        run_trading(config, live=False)


if __name__ == "__main__":
    main()
