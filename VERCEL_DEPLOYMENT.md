# Vercel Deployment Guide

**Important:** Due to Vercel's serverless architecture, we use a **hybrid deployment** strategy:

- **Frontend** → Vercel (Next.js app)
- **Backend** → Railway/Render/Fly.io (long-running Node.js server)

Why? The trading bot needs to:
- Run continuously (Vercel functions timeout after 60s)
- Maintain WebSocket connections
- Use SQLite database
- Execute trades in real-time

---

## 🚀 Quick Deploy

### Option 1: Vercel Frontend + Railway Backend (Recommended)

#### Step 1: Deploy Backend to Railway

1. **Create Railway account**: https://railway.app
2. **New Project** → **Deploy from GitHub**
3. **Select repository**: `oddspulse/Autotrader`
4. **Root directory**: `/backend`
5. **Add environment variables**:
   ```
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   PAPER_TRADING=true
   ACTIVE_SYMBOL=SOL
   HOST=0.0.0.0
   PORT=3001
   ALLOCATION_PCT=0.60
   MAX_LEVERAGE=10
   TAKE_PROFIT_PCT=0.20
   STOP_LOSS_PCT=0.05
   DAILY_LOSS_CAP_PCT=0.03
   MAX_CONSECUTIVE_LOSSES=3
   MAX_SLIPPAGE_PCT=0.003
   ```

6. **Deploy** → Railway will assign a URL like: `https://autotrader-backend-production.up.railway.app`

#### Step 2: Deploy Frontend to Vercel

1. **Create Vercel account**: https://vercel.com
2. **New Project** → **Import Git Repository**
3. **Select repository**: `oddspulse/Autotrader`
4. **Framework**: Next.js
5. **Root directory**: `/frontend`
6. **Environment variables**:
   ```
   NEXT_PUBLIC_API_URL=https://your-railway-backend.up.railway.app
   NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com
   ```

7. **Deploy** → Vercel will give you a URL like: `https://autotrader.vercel.app`

---

## Option 2: Vercel Frontend + Render Backend

#### Deploy Backend to Render

1. **Create Render account**: https://render.com
2. **New** → **Web Service**
3. **Connect GitHub**: `oddspulse/Autotrader`
4. **Settings**:
   - **Name**: autotrader-backend
   - **Root Directory**: `backend`
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid for always-on)

5. **Environment variables**: Same as Railway above

6. **Create Web Service** → Render gives you: `https://autotrader-backend.onrender.com`

#### Deploy Frontend to Vercel

Same as Option 1, Step 2, but use Render backend URL.

---

## 📱 iPad Access After Deploy

Once deployed, you can access from **any device** (not just same WiFi):

- **Desktop**: https://autotrader.vercel.app
- **iPad**: https://autotrader.vercel.app
- **Mobile**: https://autotrader.vercel.app

No IP address needed - works everywhere!

---

## 🔧 Environment Variables Reference

### Backend (Railway/Render)

| Variable | Value | Description |
|----------|-------|-------------|
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| `PAPER_TRADING` | `true` | Paper mode (true) or live (false) |
| `ACTIVE_SYMBOL` | `SOL` | Trading symbol |
| `HOST` | `0.0.0.0` | Listen on all interfaces |
| `PORT` | `3001` | Backend port |
| `ALLOCATION_PCT` | `0.60` | 60% position sizing |
| `MAX_LEVERAGE` | `10` | Max leverage |
| `TAKE_PROFIT_PCT` | `0.20` | 20% take profit |
| `STOP_LOSS_PCT` | `0.05` | 5% stop loss |
| `DAILY_LOSS_CAP_PCT` | `0.03` | 3% daily loss cap |
| `MAX_CONSECUTIVE_LOSSES` | `3` | Consecutive loss limit |
| `MAX_SLIPPAGE_PCT` | `0.003` | 0.3% max slippage |

### Frontend (Vercel)

| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.railway.app` | Backend API URL |
| `NEXT_PUBLIC_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC |

---

## 🎯 Deployment via CLI

### Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy backend
cd backend
railway init
railway up

# Get backend URL
railway domain
```

### Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy frontend
cd frontend
vercel

# Production deploy
vercel --prod
```

---

## 🔄 Continuous Deployment

### Automatic Deploys

Both Railway and Vercel support automatic deployments:

**Railway**:
- Connect GitHub repository
- Every push to `main` auto-deploys backend

**Vercel**:
- Connect GitHub repository
- Every push to `main` auto-deploys frontend

### Manual Deploys

**Railway**:
```bash
railway up
```

**Vercel**:
```bash
vercel --prod
```

---

## 💰 Pricing

### Railway
- **Free**: $5 credit/month (~500 hours)
- **Hobby**: $5/month (always-on)
- **Pro**: $20/month

### Render
- **Free**: 750 hours/month, sleeps after inactivity
- **Starter**: $7/month (always-on)

### Vercel
- **Hobby**: Free (perfect for frontend)
- **Pro**: $20/month (for production apps)

**Recommended for testing**: Railway Free + Vercel Free

---

## 🛠️ Project Structure for Deployment

```
Autotrader/
├── backend/           # Deploy to Railway/Render
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── frontend/          # Deploy to Vercel
│   ├── src/
│   ├── package.json
│   └── next.config.js
└── shared/            # Built and included in both
```

---

## ⚙️ Backend Configuration Files

### For Railway: `railway.json`

Already configured in the project. Railway auto-detects Node.js.

### For Render: `render.yaml`

Create in root directory:

```yaml
services:
  - type: web
    name: autotrader-backend
    env: node
    region: oregon
    plan: free
    buildCommand: cd backend && npm install && npm run build
    startCommand: cd backend && npm start
    envVars:
      - key: SOLANA_RPC_URL
        value: https://api.mainnet-beta.solana.com
      - key: PAPER_TRADING
        value: true
      - key: ACTIVE_SYMBOL
        value: SOL
      - key: HOST
        value: 0.0.0.0
      - key: PORT
        value: 3001
```

---

## 🔐 Security Notes

### CORS Configuration

Backend already configured to allow Vercel domains:

```typescript
// backend/src/server/ApiServer.ts
cors: {
  origin: config.paperTrading ? "*" : process.env.FRONTEND_URL,
  methods: ["GET", "POST"],
}
```

For production, set `FRONTEND_URL=https://autotrader.vercel.app`

### Environment Variables

**Never commit**:
- Private keys
- Seed phrases
- API secrets

Use platform environment variable managers:
- Railway: Dashboard → Variables
- Vercel: Dashboard → Settings → Environment Variables

---

## 🧪 Testing Deployed App

### 1. Test Backend

```bash
curl https://your-backend.railway.app/api/health
```

Should return:
```json
{"success":true,"data":{"status":"ok"}}
```

### 2. Test Frontend

Open: https://your-app.vercel.app

Should see the dashboard.

### 3. Test Integration

1. Connect Phantom wallet
2. Start bot
3. Check live logs
4. Verify WebSocket connection

---

## 📊 Monitoring

### Railway Dashboard
- View logs
- Monitor CPU/memory
- Check uptime
- Restart services

### Vercel Dashboard
- View function logs
- Monitor bandwidth
- Check build status
- Analytics

---

## 🐛 Troubleshooting

### Backend won't start on Railway

**Check logs**:
```bash
railway logs
```

**Common issues**:
- Missing environment variables
- Build failed (check `npm run build`)
- Port binding (use `0.0.0.0:$PORT`)

### Frontend can't connect to backend

**Check CORS**:
```bash
curl -H "Origin: https://your-frontend.vercel.app" \
     https://your-backend.railway.app/api/status
```

**Solution**: Add `FRONTEND_URL` to backend env vars

### WebSocket connection fails

**Check Railway/Render WebSocket support**: Both support WSS (secure WebSocket)

**Ensure frontend uses wss://**:
```typescript
const socket = io(backendUrl, {
  transports: ['websocket', 'polling']
});
```

---

## 🚀 Production Checklist

Before going live:

- [ ] Backend deployed and running
- [ ] Frontend deployed and accessible
- [ ] Environment variables set correctly
- [ ] CORS configured for production domain
- [ ] Test wallet connection
- [ ] Verify paper trading mode
- [ ] Test full trading cycle
- [ ] Set up monitoring/alerts
- [ ] Configure auto-restarts
- [ ] Backup database (if using persistent storage)

---

## 📞 Support

### Railway
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway

### Vercel
- Docs: https://vercel.com/docs
- Community: https://github.com/vercel/vercel/discussions

### Render
- Docs: https://render.com/docs
- Support: https://render.com/support

---

## 🎉 Quick Deploy Commands

**Full deployment in 3 commands**:

```bash
# 1. Deploy backend to Railway
cd backend && railway up

# 2. Get backend URL
export BACKEND_URL=$(railway domain)

# 3. Deploy frontend to Vercel
cd ../frontend && vercel --prod --env NEXT_PUBLIC_API_URL=$BACKEND_URL
```

Done! Your app is live globally. 🌍✨

---

## Alternative: All-Vercel Deployment (Limited)

If you want everything on Vercel (not recommended for continuous trading):

1. Convert backend to Next.js API routes
2. Use Vercel Cron Jobs for periodic tasks (max 60s execution)
3. Use Vercel KV for state storage
4. No real-time WebSocket (use polling)

**Limitations**:
- No continuous bot execution
- Functions timeout after 60 seconds
- Requires significant refactoring
- Not suitable for real-time trading

**Better approach**: Use Railway/Render for backend as described above.
