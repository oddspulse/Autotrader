# Autotrader - Kraken Spot Trading Bot

Fully automated crypto trading system for Kraken spot markets with Full Kelly criterion position sizing.

**Jurisdiction**: Ontario, Canada (spot-only, no margin/futures)

## Architecture

```
bot-runner/  (Python, runs on VPS 24/7)
  -> Executes trades on Kraken
  -> Writes to Supabase Postgres

dashboard/   (Next.js, deployed on Vercel)
  -> Reads from Supabase Postgres
  -> Read-only display of metrics
  -> Password-protected

schema.sql   (Database migration)
```

## Trading Strategy

- **EMA Crossover with Trend Filter**: 20/50 EMA crossover aligned with 200 EMA trend
- **Volatility Guard**: ATR% filter skips high-volatility entries
- **Kelly Criterion**: Full Kelly position sizing (profit or not survive model)
- **Stop Loss**: 1.5x ATR initial stop, 2.5x ATR trailing stop
- **Risk Limits**: 2% daily loss cap, 8% max drawdown kill switch, 3 max positions

## Pairs

BTC, ETH, SOL against USD, USDT, USDC, and CAD (12 pairs total).

## Quick Start

See [SETUP.md](SETUP.md) for complete setup instructions.

### Paper Trading (local)

```bash
cd bot-runner
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Supabase and Telegram credentials
python main.py
```

### Backtest

```bash
cd bot-runner
python main.py --backtest
```

### Live Trading

```bash
cd bot-runner
python main.py --live
```

## Safety Features

- Paper trading mode by default
- Daily loss kill switch (2%)
- Max drawdown kill switch (8%)
- API failure circuit breaker
- Per-pair cooldown after stop-out
- Time sync verification
- Minimum volume filter
- No dashboard trade execution (read-only)

## Disclaimer

This is not financial advice. Trading cryptocurrency involves substantial risk of loss. The Full Kelly criterion is aggressive and can produce large drawdowns. You are solely responsible for any financial losses.
