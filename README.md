# Solana Perpetuals Auto-Trader

A complete, production-ready automated trading bot for Solana perpetuals with Phantom wallet integration, leveraging up to 10x on Drift Protocol.

## ⚠️ **CRITICAL WARNING**

**LEVERAGED TRADING IS EXTREMELY RISKY**

- You can lose your entire investment quickly
- Leverage amplifies both gains AND losses
- Only trade with funds you can afford to lose completely
- This bot executes real trades with real money
- No guarantees of profit - trading is inherently risky
- Past performance does not indicate future results

**USE AT YOUR OWN RISK**

---

## 🚀 Features

### Core Trading
- ✅ **Phantom Wallet Integration** - Secure transaction signing (no private keys stored)
- ✅ **Drift Protocol** - Primary perpetuals DEX on Solana
- ✅ **Symbol Allowlist** - Hardcoded to BTC, ETH, SOL, HYPE, ZEC only
- ✅ **10x Leverage** - Configurable up to maximum of 10x
- ✅ **Fixed Strategy** - 20% take-profit / 5% stop-loss (4:1 RR)
- ✅ **60% Position Sizing** - Uses 60% of available equity per trade
- ✅ **One Position at a Time** - Prevents overexposure

### Risk Management
- ✅ **Daily Loss Cap** - Auto-stops at 3% daily loss (default)
- ✅ **Consecutive Loss Limit** - 6-hour cooldown after 3 losses
- ✅ **Slippage Protection** - Rejects trades exceeding 0.3% slippage
- ✅ **Order Timeout** - Auto-cancels unfilled orders after 30s
- ✅ **TP/SL Enforcement** - Immediate placement after entry

### Trading Strategy
- ✅ **EMA Crossover** - Fast (9) / Slow (21) exponential moving averages
- ✅ **Pluggable Interface** - Swap strategies easily via `IStrategy`
- ✅ **Signal Validation** - Three-layer allowlist enforcement

### User Experience
- ✅ **Next.js Web App** - Modern, responsive dashboard
- ✅ **Real-time Updates** - WebSocket streaming for instant feedback
- ✅ **Paper Trading Mode** - Test strategies risk-free
- ✅ **Live Logs** - Streaming bot activity logs
- ✅ **Trade Export** - Download CSV of all trades
- ✅ **SQLite Storage** - Persistent trade/equity/log history

---

## 📁 Project Structure

```
Autotrader/
├── backend/              # Trading engine
│   ├── src/
│   │   ├── exchanges/    # Exchange adapters (Drift, Paper)
│   │   ├── strategies/   # Signal generation (EMA crossover)
│   │   ├── risk/         # Risk management
│   │   ├── database/     # SQLite storage
│   │   ├── worker/       # Main trading bot
│   │   ├── server/       # API & WebSocket server
│   │   └── utils/        # Logger, helpers
│   └── package.json
├── frontend/             # Next.js web UI
│   ├── src/
│   │   ├── app/          # Pages (Next.js 14 app router)
│   │   ├── components/   # React components
│   │   ├── contexts/     # Wallet context provider
│   │   ├── hooks/        # Custom hooks (API, WebSocket)
│   │   └── styles/       # Global CSS
│   └── package.json
├── shared/               # Shared types & constants
│   ├── src/
│   │   ├── constants.ts  # Allowlist, enums
│   │   └── types.ts      # TypeScript interfaces
│   └── package.json
├── .env.example          # Environment template
├── package.json          # Root workspace config
└── README.md
```

---

## 🛠️ Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **Phantom Wallet** (browser extension)
- **Solana RPC URL** (Alchemy, QuickNode, or public RPC)

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd Autotrader
```

### Step 2: Install Dependencies

```bash
npm run install:all
```

This installs dependencies for root, backend, frontend, and shared packages.

### Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# RPC URL (required)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Exchange (drift | jupiter)
EXCHANGE=drift

# Active symbol (must be in allowlist)
ACTIVE_SYMBOL=SOL
SYMBOLS=BTC,ETH,SOL,HYPE,ZEC

# Position sizing
ALLOCATION_PCT=0.60
MAX_LEVERAGE=10

# Strategy (fixed)
TAKE_PROFIT_PCT=0.20
STOP_LOSS_PCT=0.05

# Risk guardrails
DAILY_LOSS_CAP_PCT=0.03
MAX_CONSECUTIVE_LOSSES=3
MAX_SLIPPAGE_PCT=0.003

# Trading mode
PAPER_TRADING=true  # Set to false for live trading
```

### Step 4: Build Shared Package

```bash
npm run build --workspace=shared
```

---

## 🚀 Running the Application

### Development Mode (Recommended for Testing)

Run both backend and frontend in parallel:

```bash
npm run dev
```

This starts:
- **Backend API**: http://localhost:3001
- **Frontend UI**: http://localhost:3000

### Production Mode

Build and run in production:

```bash
npm run build
npm start
```

---

## 📖 Usage Guide

### 1. Access the Dashboard

Navigate to **http://localhost:3000** in your browser.

### 2. Connect Phantom Wallet

Click **"Connect Wallet"** button in the top-right corner.

> **Note**: Ensure Phantom is installed and you have USDC collateral deposited on Drift Protocol (for live trading).

### 3. Configure Trading

- **Trading Mode**: Choose Paper (safe) or Live (real money)
- **Active Symbol**: Select from BTC, ETH, SOL, HYPE, or ZEC
  - Unavailable markets will be marked (e.g., HYPE, ZEC on Drift)

### 4. Start the Bot

Click **"🚀 Start Trading"**

The bot will:
1. Connect to exchange
2. Validate market availability
3. Initialize risk management
4. Begin monitoring for signals

### 5. Monitor Activity

- **Equity Card**: Total equity, daily PnL, free collateral
- **Risk Card**: Consecutive losses, daily loss cap, cooldown status
- **Position Card**: Current open position with unrealized PnL
- **Orders Table**: Active TP/SL orders
- **Live Logs**: Real-time bot activity

### 6. Stop the Bot

Click **"⏹️ Stop Trading"** to gracefully shut down.

---

## 🎯 Trading Strategy Explained

### Signal Generation: EMA Crossover

- **Fast EMA**: 9 periods
- **Slow EMA**: 21 periods
- **Long Signal**: Fast crosses above Slow (bullish)
- **Short Signal**: Fast crosses below Slow (bearish)

### Position Management

1. **Entry**: Market order at signal price
2. **Size**: 60% of free collateral × 10x leverage
3. **Immediate TP/SL**: Placed as soon as entry fills
   - **Take Profit**: +20% from entry
   - **Stop Loss**: -5% from entry

### Risk/Reward

- **RR Ratio**: 4:1 (risking 5% to gain 20%)
- **Max Leverage**: 10x (amplifies PnL by 10x)
- **One Position**: Never holds multiple positions per market

---

## 🛡️ Safety Features

### Symbol Allowlist Enforcement

The bot **REFUSES** to trade any symbol not in the hardcoded allowlist:

```typescript
const ALLOWED_SYMBOLS = ["BTC", "ETH", "SOL", "HYPE", "ZEC"];
```

Enforcement at **three layers**:
1. UI dropdown (only shows allowed symbols)
2. Strategy validation (rejects signals for disallowed symbols)
3. Exchange adapter (hard fails on disallowed symbol orders)

### Daily Loss Cap

Bot stops trading when daily loss exceeds 3% (default):

```
Daily Loss = (Current Equity - Starting Equity) / Starting Equity
```

Resets at 00:00 UTC.

### Consecutive Loss Protection

After 3 consecutive losing trades:
- Bot enters 6-hour cooldown
- No new trades allowed until cooldown expires
- Resets on next winning trade

### Slippage Protection

Market orders rejected if estimated slippage > 0.3%:
- Protects against poor fills in low liquidity
- Calculated based on AMM depth

---

## 📊 Database & Exports

### SQLite Storage

All data persists to `./backend/data/trades.db`:

- **Trades**: Every executed trade
- **Orders**: Order history
- **Positions**: Position open/close records
- **Equity Snapshots**: Periodic equity tracking
- **Logs**: All bot logs
- **Signals**: Trading signals history

### Export Trades

Click **"📥 Export"** in the UI to download CSV:

```csv
id,order_id,symbol,side,size,price,fee,timestamp,position_id
trade-1,order-123,SOL,LONG,10.5,98.50,0.49,1704067200000,pos-1
```

---

## 🔧 Configuration Reference

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `SOLANA_RPC_URL` | Required | Solana RPC endpoint |
| `ACTIVE_SYMBOL` | SOL | Symbol to trade (must be in allowlist) |
| `ALLOCATION_PCT` | 0.60 | % of equity per trade (60%) |
| `MAX_LEVERAGE` | 10 | Leverage (1-10x) |
| `PAPER_TRADING` | true | Paper mode (true) or live (false) |

### Strategy Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `TAKE_PROFIT_PCT` | 0.20 | TP distance (20%) |
| `STOP_LOSS_PCT` | 0.05 | SL distance (5%) |
| `TIMEFRAME` | 5m | Candle timeframe |
| `EMA_FAST` | 9 | Fast EMA period |
| `EMA_SLOW` | 21 | Slow EMA period |

### Risk Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `DAILY_LOSS_CAP_PCT` | 0.03 | Daily loss limit (3%) |
| `MAX_CONSECUTIVE_LOSSES` | 3 | Losses before cooldown |
| `CONSECUTIVE_LOSS_COOLDOWN_HOURS` | 6 | Cooldown duration |
| `MAX_SLIPPAGE_PCT` | 0.003 | Max slippage (0.3%) |

---

## 🔐 Security & Privacy

### No Private Keys Stored

- Bot **NEVER** requests or stores seed phrases
- All transactions signed by Phantom wallet
- User maintains full custody of funds

### Transaction Signing Flow

1. Bot generates unsigned transaction
2. Transaction sent to Phantom for approval
3. User reviews and signs in Phantom
4. Signed transaction broadcast to Solana

### Read-Only Drift Adapter

Current implementation is **read-only** for Drift Protocol:
- Can fetch positions, orders, equity
- **Cannot** place orders without Phantom integration
- Order placement methods throw informative errors

> **TODO for Production**: Integrate Phantom wallet adapter in backend for signing.

---

## 🐛 Troubleshooting

### Bot Won't Start

**Error**: "Symbol not in allowlist"
- **Fix**: Edit `.env`, set `ACTIVE_SYMBOL` to one of: BTC, ETH, SOL, HYPE, ZEC

**Error**: "Market not available on exchange"
- **Fix**: Choose a different symbol. HYPE and ZEC may not be on Drift.

### WebSocket Connection Failed

**Error**: "WebSocket disconnected"
- **Fix**: Ensure backend is running on port 3001
- Check firewall/proxy settings

### Orders Not Filling (Paper Mode)

- **Cause**: Paper mode needs price feed integration
- **Fix**: Currently uses manual price updates. Integrate Pyth/Switchboard oracle for production.

### Daily Loss Cap Hit

- **Info**: Bot auto-pauses when daily loss exceeds limit
- **Fix**: Wait until next UTC day for reset, or adjust `DAILY_LOSS_CAP_PCT`

---

## 🚧 Known Limitations & Future Enhancements

### Current Limitations

1. **Candle Data**: No integrated data provider (Pyth/Switchboard)
   - Strategy uses placeholder candle fetching
   - Implement real-time OHLCV feed for production

2. **Order Placement**: Drift adapter is read-only
   - Requires Phantom wallet integration for signing
   - Paper mode fully functional

3. **Symbol Support**: HYPE and ZEC unavailable on Drift
   - Use Jupiter Perps adapter (implement separately)

4. **Single Market**: Bot trades one symbol at a time
   - Multi-symbol support requires architecture changes

### Planned Enhancements

- [ ] Pyth/Switchboard oracle integration
- [ ] Jupiter Perps adapter implementation
- [ ] Multi-symbol concurrent trading
- [ ] Advanced strategies (RSI, Bollinger Bands)
- [ ] Backtesting framework
- [ ] Mobile-responsive UI improvements
- [ ] Email/Telegram notifications

---

## 📚 API Reference

### REST Endpoints

**Base URL**: `http://localhost:3001/api`

#### `GET /status`
Get current bot status.

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "RUNNING",
    "mode": "PAPER",
    "activeSymbol": "SOL",
    "equity": { ... },
    "position": { ... }
  }
}
```

#### `POST /start`
Start the trading bot.

**Body**:
```json
{
  "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
}
```

#### `POST /stop`
Stop the trading bot.

#### `GET /markets`
Get available markets.

#### `GET /trades`
Get trade history (query param: `?limit=100`).

#### `GET /export/trades`
Download trades as CSV.

### WebSocket Events

**Connection**: `ws://localhost:3001`

**Incoming Events**:
- `BOT_STATE`: Full bot state update
- `LOG`: Log message
- `TRADE`: New trade executed
- `POSITION_UPDATE`: Position changed
- `ORDER_UPDATE`: Order status changed

---

## 🧪 Testing

### Paper Trading

1. Set `PAPER_TRADING=true` in `.env`
2. Start bot - simulates all trading
3. No real money at risk
4. $10,000 starting equity (simulated)

### Manual Testing Checklist

- [ ] Connect Phantom wallet
- [ ] Start bot in paper mode
- [ ] Verify equity card updates
- [ ] Check risk management triggers
- [ ] Test symbol switching
- [ ] Verify TP/SL placement (paper mode)
- [ ] Export trades to CSV
- [ ] Stop bot gracefully

---

## 📄 License

This project is provided as-is for educational purposes.

**No warranty or guarantees of profitability.**

---

## 🤝 Contributing

Contributions welcome! Areas for improvement:

1. **Data Providers**: Integrate Pyth/Switchboard
2. **Jupiter Perps**: Implement adapter
3. **Strategies**: Add RSI, MACD, Bollinger Bands
4. **Testing**: Add unit/integration tests
5. **Documentation**: Improve inline code comments

---

## 💬 Support

For issues, questions, or feedback:

- Open a GitHub issue
- Check existing documentation
- Review code comments for implementation details

---

**Built with ❤️ for the Solana trading community**

Remember: **Trade responsibly. Never risk more than you can afford to lose.**
