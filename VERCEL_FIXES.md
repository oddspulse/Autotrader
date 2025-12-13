# 🔧 Vercel Deployment - Fixed!

I've fixed the Vercel deployment errors and added auto-start functionality.

---

## ✅ What I Fixed

### 1. Vercel Build Errors
**Problem**: Vercel couldn't build because of monorepo structure (shared package dependency)

**Solution**:
- Added `build:shared` script to frontend package.json
- Frontend now builds shared package before its own build
- Added `vercel-build` command specifically for Vercel

### 2. Auto-Start Feature
**Problem**: Bot required manual start after deployment

**Solution**:
- Added `AUTO_START` environment variable
- Added `AUTO_START_WALLET` environment variable
- Bot now starts automatically on backend deployment (optional)

---

## 🚀 Deploy to Vercel (Updated Instructions)

### Step 1: Deploy Backend to Railway

1. Go to https://railway.app
2. **New Project** → **Deploy from GitHub**
3. Select: `oddspulse/Autotrader`
4. **Root directory**: Leave blank (uses `/backend` from config)
5. **Add environment variables**:

```env
# Required
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
PAPER_TRADING=true
ACTIVE_SYMBOL=SOL
HOST=0.0.0.0
PORT=3001

# Optional: Auto-start (NEW!)
AUTO_START=true
AUTO_START_WALLET=YOUR_PHANTOM_WALLET_ADDRESS

# Risk settings
ALLOCATION_PCT=0.60
MAX_LEVERAGE=10
TAKE_PROFIT_PCT=0.20
STOP_LOSS_PCT=0.05
DAILY_LOSS_CAP_PCT=0.03
MAX_CONSECUTIVE_LOSSES=3
MAX_SLIPPAGE_PCT=0.003
```

6. **Deploy** → Wait for deployment
7. **Generate Domain** → Copy URL

### Step 2: Deploy Frontend to Vercel

1. Go to https://vercel.com
2. **New Project** → **Import** `oddspulse/Autotrader`
3. **Root directory**: `frontend`
4. **Framework**: Next.js (auto-detected)
5. **Add environment variables**:

```env
NEXT_PUBLIC_API_URL=https://your-railway-url.up.railway.app
NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com
```

6. **Deploy** → Vercel will build and deploy

---

## 🤖 Auto-Start Feature

### What It Does

When enabled, the bot automatically starts when your backend deploys (e.g., on Railway/Render).

**Benefits**:
- No manual start needed after deployment
- Bot runs 24/7 automatically
- Survives backend restarts
- Perfect for cloud deployments

### How to Enable

**Option 1: For Testing (Recommended)**

Don't enable auto-start. Start manually via the UI.

**Option 2: For Production (24/7 Trading)**

Add to Railway/Render environment variables:

```env
AUTO_START=true
AUTO_START_WALLET=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

Replace with your actual Phantom wallet public key.

### How to Get Your Wallet Address

1. Open Phantom app
2. Tap your wallet at the top
3. Tap the wallet address
4. **Copy** button
5. Paste into `AUTO_START_WALLET`

### Security Note

⚠️ **Your wallet public key is safe to use in environment variables**
- Public keys are **publicly visible** on-chain
- This is NOT your seed phrase/private key
- No security risk

---

## 🐛 Common Vercel Errors & Fixes

### Error: "Module not found: @autotrader/shared"

**Cause**: Shared package not built before frontend

**Fix**: Already fixed! Frontend now builds shared package automatically.

**Verify**: Check `frontend/package.json` has:
```json
"vercel-build": "npm run build:shared && next build"
```

### Error: "ENOENT: no such file or directory '../shared'"

**Cause**: Vercel can't access parent directory

**Fix**: Deploy from frontend folder or use correct root directory

**Vercel Settings**:
- Root Directory: `frontend`
- Build Command: `npm run vercel-build` (auto-detected)

### Error: "Failed to load next.config.js"

**Cause**: Missing dependencies or wrong Node version

**Fix**:
1. Ensure Node 18+ in Vercel settings
2. Check `frontend/package.json` dependencies installed

### Auto-Start Not Working

**Symptoms**: Backend starts but bot doesn't run

**Checklist**:
- [ ] `AUTO_START=true` (exactly, case-sensitive)
- [ ] `AUTO_START_WALLET` set to valid address
- [ ] Check Railway logs for auto-start messages
- [ ] Wallet address is correct (copy from Phantom)

**Debug**:
```bash
# Check Railway logs
railway logs --service backend

# Look for:
# "AUTO_START enabled - Bot will start automatically"
# "Auto-starting with wallet: YOUR_ADDRESS"
# "Bot auto-started successfully"
```

---

## 📋 Deployment Checklist

### Before Deploy

- [ ] Shared package builds locally: `cd shared && npm run build`
- [ ] Frontend builds locally: `cd frontend && npm run vercel-build`
- [ ] Backend runs locally: `cd backend && npm run dev`
- [ ] Environment variables ready (see below)

### Railway Backend

- [ ] `SOLANA_RPC_URL` set
- [ ] `PAPER_TRADING=true` (for testing)
- [ ] `ACTIVE_SYMBOL` set (SOL, BTC, or ETH)
- [ ] `HOST=0.0.0.0`
- [ ] `PORT=3001` (or Railway default)
- [ ] `AUTO_START` configured (optional)
- [ ] `AUTO_START_WALLET` set (if auto-start enabled)

### Vercel Frontend

- [ ] `NEXT_PUBLIC_API_URL` = Railway backend URL
- [ ] `NEXT_PUBLIC_RPC_URL` set
- [ ] Root directory = `frontend`
- [ ] Build command = auto-detected

### After Deploy

- [ ] Backend health check: `curl https://backend.railway.app/api/health`
- [ ] Frontend loads: Visit Vercel URL
- [ ] WebSocket connects: Check browser console
- [ ] Bot starts (manual or auto)
- [ ] Logs appear in UI

---

## 🔄 Redeploy After Changes

### Auto-Deploy (Recommended)

**Setup once**:
1. Railway: Connect GitHub repo
2. Vercel: Connect GitHub repo
3. Enable auto-deploy on both

**Then**: Every `git push` auto-deploys!

### Manual Deploy

**Railway**:
```bash
railway up
```

**Vercel**:
```bash
cd frontend
vercel --prod
```

---

## 📊 Environment Variables Reference

### Backend (Railway/Render)

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `SOLANA_RPC_URL` | ✅ | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| `PAPER_TRADING` | ✅ | `true` | Paper (true) or live (false) |
| `ACTIVE_SYMBOL` | ✅ | `SOL` | Trading symbol |
| `HOST` | ✅ | `0.0.0.0` | Listen address |
| `PORT` | No | `3001` | Server port |
| `AUTO_START` | No | `true` | Auto-start bot |
| `AUTO_START_WALLET` | No | `7xKX...` | Wallet address |
| `ALLOCATION_PCT` | No | `0.60` | Position size (60%) |
| `MAX_LEVERAGE` | No | `10` | Max leverage |
| `TAKE_PROFIT_PCT` | No | `0.20` | TP (20%) |
| `STOP_LOSS_PCT` | No | `0.05` | SL (5%) |
| `DAILY_LOSS_CAP_PCT` | No | `0.03` | Daily loss limit (3%) |
| `MAX_CONSECUTIVE_LOSSES` | No | `3` | Loss limit |
| `MAX_SLIPPAGE_PCT` | No | `0.003` | Max slippage (0.3%) |

### Frontend (Vercel)

| Variable | Required | Example |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | ✅ | `https://backend.railway.app` |
| `NEXT_PUBLIC_RPC_URL` | ✅ | `https://api.mainnet-beta.solana.com` |

---

## 🎉 Success Indicators

### Backend Deployed Successfully

Visit: `https://your-backend.railway.app/api/health`

Should see:
```json
{"success":true,"data":{"status":"ok"}}
```

### Frontend Deployed Successfully

Visit: `https://your-app.vercel.app`

Should see: Trading dashboard with "Connect Wallet" button

### Auto-Start Working

Check Railway logs:
```
AUTO_START enabled - Bot will start automatically
Auto-starting with wallet: 7xKX...
Bot auto-started successfully
```

### Full Integration

1. Open frontend
2. Dashboard shows bot status: RUNNING (if auto-start enabled)
3. Logs appear automatically
4. Position/equity cards update

---

## 💡 Tips

### Development Workflow

1. **Test locally first**: `npm run dev:backend` and `npm run dev:frontend`
2. **Commit changes**: `git add -A && git commit -m "your message"`
3. **Push to deploy**: `git push` (if auto-deploy enabled)
4. **Monitor logs**: Railway dashboard for backend, Vercel for frontend

### Cost Optimization

**Free Tier**:
- Railway: $5 credit (~500 hours)
- Vercel: Unlimited
- **Don't enable auto-start** to save credits (start manually)

**Always-On** ($5/month):
- Railway Hobby: $5/month
- **Enable auto-start** for 24/7 trading

### Security

**Safe to commit**:
- Configuration files
- Source code
- Public keys

**NEVER commit**:
- `.env` files
- Private keys
- Seed phrases

Use platform environment variables instead!

---

## 🆘 Still Getting Errors?

Share the exact error message and I'll help you fix it!

Common places to find errors:
- **Vercel**: Deployment → Build Logs
- **Railway**: Service → Logs
- **Browser**: Console (F12)

---

**All fixes committed and pushed!** 🚀

Ready to deploy to Vercel with auto-start support!
