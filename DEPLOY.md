# 🚀 One-Click Deploy Guide

Deploy your Solana Perps Auto-Trader to the cloud in minutes!

---

## 🎯 Quickest Deploy (3 Clicks)

### Deploy Backend to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/solana-autotrader)

1. Click button above
2. Fork repository (if prompted)
3. Set environment variables (auto-filled)
4. Deploy!

**Get your backend URL**: Copy from Railway dashboard

### Deploy Frontend to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/oddspulse/Autotrader&root-directory=frontend&env=NEXT_PUBLIC_API_URL,NEXT_PUBLIC_RPC_URL&envDescription=Backend%20API%20URL%20and%20Solana%20RPC&project-name=solana-autotrader&repository-name=solana-autotrader)

1. Click button above
2. Add environment variables:
   - `NEXT_PUBLIC_API_URL`: Your Railway backend URL
   - `NEXT_PUBLIC_RPC_URL`: `https://api.mainnet-beta.solana.com`
3. Deploy!

---

## 📋 Manual Deploy Steps

If one-click doesn't work, follow these steps:

### Step 1: Deploy Backend

**Option A: Railway (Recommended)**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Navigate to backend
cd backend

# Initialize project
railway init

# Deploy
railway up

# Get URL
railway domain
```

**Option B: Render**

1. Go to https://render.com
2. New → Web Service
3. Connect GitHub: `oddspulse/Autotrader`
4. Root Directory: `backend`
5. Build Command: `npm install && npm run build`
6. Start Command: `npm start`
7. Add environment variables (see below)
8. Create Web Service

### Step 2: Deploy Frontend

**Vercel (Recommended)**

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to frontend
cd frontend

# Set backend URL (replace with your Railway/Render URL)
export NEXT_PUBLIC_API_URL=https://your-backend.railway.app

# Deploy
vercel

# Production
vercel --prod
```

---

## ⚙️ Environment Variables

### Backend (Railway/Render)

Required:
```env
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
PAPER_TRADING=true
ACTIVE_SYMBOL=SOL
HOST=0.0.0.0
PORT=3001
```

Optional (with defaults):
```env
ALLOCATION_PCT=0.60
MAX_LEVERAGE=10
TAKE_PROFIT_PCT=0.20
STOP_LOSS_PCT=0.05
DAILY_LOSS_CAP_PCT=0.03
MAX_CONSECUTIVE_LOSSES=3
MAX_SLIPPAGE_PCT=0.003
```

### Frontend (Vercel)

Required:
```env
NEXT_PUBLIC_API_URL=https://your-backend-url.com
NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com
```

---

## 🧪 Test Deployment

### 1. Test Backend

```bash
curl https://your-backend.railway.app/api/health
```

Expected response:
```json
{"success":true,"data":{"status":"ok"}}
```

### 2. Test Frontend

Open: `https://your-app.vercel.app`

You should see the trading dashboard.

### 3. Full Integration Test

1. Open frontend URL
2. Click "Connect Wallet"
3. Approve in Phantom
4. Start bot in paper mode
5. Check live logs

---

## 💳 Pricing

### Free Tier (Perfect for Testing)

- **Railway**: $5 credit/month (~500 hours)
- **Vercel**: Unlimited frontend hosting
- **Total**: $0/month

### Paid (Always-On Production)

- **Railway Hobby**: $5/month
- **Vercel Pro**: $20/month (optional)
- **Total**: $5-25/month

---

## 🔄 Auto-Deploy on Git Push

Both platforms support automatic deployments:

### Railway
1. Dashboard → Settings → Deployments
2. Enable "Auto-deploy from GitHub"
3. Select branch: `main`

Every push to `main` auto-deploys backend!

### Vercel
1. Dashboard → Settings → Git
2. Production Branch: `main`
3. Enable automatic deployments

Every push to `main` auto-deploys frontend!

---

## 📊 Monitoring

### Railway Dashboard

- **Logs**: Real-time logs from your bot
- **Metrics**: CPU, memory, network usage
- **Deployments**: History and rollback
- **Variables**: Manage environment variables

Access: https://railway.app/dashboard

### Vercel Dashboard

- **Logs**: Function execution logs
- **Analytics**: Page views, performance
- **Deployments**: Preview and production
- **Domains**: Custom domain management

Access: https://vercel.com/dashboard

---

## 🐛 Common Issues

### Backend deployment fails

**Error**: "Build failed"

**Solution**:
```bash
# Check build locally first
cd backend
npm install
npm run build
```

### Frontend can't connect to backend

**Error**: "Failed to fetch"

**Solution**:
1. Check `NEXT_PUBLIC_API_URL` is correct
2. Verify CORS in backend (should allow all origins in paper mode)
3. Test backend health endpoint directly

### WebSocket connection drops

**Error**: "WebSocket disconnected"

**Solution**:
1. Railway/Render both support WebSockets
2. Check backend logs for errors
3. Verify frontend using correct protocol (wss:// for HTTPS)

---

## 🚀 Production Checklist

Before going live with real money:

- [ ] Backend deployed and accessible
- [ ] Frontend deployed and working
- [ ] All environment variables set
- [ ] Test wallet connection works
- [ ] Paper trading tested thoroughly
- [ ] Daily loss cap configured
- [ ] Monitoring/alerts set up
- [ ] Backup plan for downtime
- [ ] CORS configured correctly
- [ ] SSL/HTTPS enabled (automatic on Railway/Vercel)

---

## 🔐 Security

### Never Commit:
- Private keys
- Seed phrases
- `.env` files

### Use Platform Secrets:
- Railway: Environment Variables
- Vercel: Environment Variables
- GitHub: Secrets (for CI/CD)

### Enable 2FA:
- Railway account
- Vercel account
- GitHub account

---

## 📱 Access Your App

After deployment:

**From anywhere** (iPad, phone, desktop):
```
https://your-app.vercel.app
```

No IP addresses needed - works globally! ✨

---

## 🆘 Support

### Railway
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway
- Status: https://status.railway.app

### Vercel
- Docs: https://vercel.com/docs
- Community: https://github.com/vercel/vercel/discussions
- Status: https://vercel-status.com

---

## 🎉 Quick Commands Summary

**Full deploy in 2 commands**:

```bash
# 1. Deploy backend
cd backend && railway up

# 2. Deploy frontend (with backend URL)
cd ../frontend && \
  export NEXT_PUBLIC_API_URL=$(cd ../backend && railway domain) && \
  vercel --prod
```

**Done!** 🚀

Your Solana auto-trader is now live and accessible from any device, anywhere in the world.
