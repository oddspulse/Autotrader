# Quick Start Guide

Get up and running in 5 minutes.

## 1. Install Dependencies

```bash
npm run install:all
```

## 2. Create Environment File

```bash
cp .env.example .env
```

Edit `.env` and set:
- `PAPER_TRADING=true` (start with paper trading)
- `ACTIVE_SYMBOL=SOL` (or BTC, ETH)
- `SOLANA_RPC_URL=https://api.mainnet-beta.solana.com`

## 3. Build Shared Package

```bash
npm run build --workspace=shared
```

## 4. Start the Application

```bash
npm run dev
```

This starts both backend (port 3001) and frontend (port 3000).

## 5. Open Browser

Navigate to **http://localhost:3000**

## 6. Connect Wallet

1. Click "Connect Wallet" button
2. Select Phantom
3. Approve connection

## 7. Start Trading

1. Keep trading mode on **Paper Trading**
2. Select a symbol (SOL recommended)
3. Click **"🚀 Start Trading"**

## 8. Monitor Activity

Watch the dashboard for:
- Position updates
- Equity changes
- Risk status
- Live logs

## 9. Stop Trading

Click **"⏹️ Stop Trading"** when done.

---

## Next Steps

- Review the full [README.md](./README.md)
- Adjust risk settings in `.env`
- Try different symbols
- Export trade history

---

## Switching to Live Trading

⚠️ **WARNING: REAL MONEY AT RISK** ⚠️

1. Ensure you have USDC deposited on Drift Protocol
2. Set `PAPER_TRADING=false` in `.env`
3. Restart the bot
4. All trades will be executed on-chain

**Only do this if you:**
- Understand the risks
- Have tested thoroughly in paper mode
- Can afford to lose your entire deposit
- Have reviewed the code

---

## Troubleshooting

**Backend won't start?**
- Make sure ports 3001 and 3000 are free
- Check `.env` file is present

**Frontend errors?**
- Clear browser cache
- Refresh page
- Check browser console

**Bot not trading?**
- Check risk limits (daily loss cap, consecutive losses)
- Verify symbol is available on Drift
- Check logs panel for errors

---

**Happy trading! 🚀**
