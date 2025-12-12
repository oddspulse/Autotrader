#!/bin/bash

# Setup script for iPad access
# This configures the frontend with your computer's IP address

echo "🔧 Solana Auto-Trader iPad Setup"
echo "=================================="
echo ""

# Get IP address
echo "📡 Detecting your computer's IP address..."
IP=$(node get-ip.js 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1)

if [ -z "$IP" ]; then
    echo "❌ Could not detect IP address automatically"
    echo ""
    echo "Please run: node get-ip.js"
    echo "Then manually edit frontend/.env.local"
    exit 1
fi

echo "✅ Found IP: $IP"
echo ""

# Update frontend .env.local
echo "📝 Updating frontend configuration..."
cat > frontend/.env.local <<EOF
# Frontend environment variables (auto-generated)
# If your IP changes, re-run: ./setup-ipad.sh

# Backend API URL (for iPad access)
NEXT_PUBLIC_API_URL=http://$IP:3001

# Solana RPC
NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com
EOF

echo "✅ Frontend configured with IP: $IP"
echo ""

# Display instructions
echo "📱 iPad Access Instructions:"
echo "=================================="
echo ""
echo "1. Make sure your iPad is on the SAME WiFi network"
echo ""
echo "2. Start the backend (in one terminal):"
echo "   npm run dev:backend"
echo ""
echo "3. Start the frontend (in another terminal):"
echo "   npm run dev:frontend"
echo ""
echo "4. On your iPad, open Safari and go to:"
echo "   http://$IP:3000"
echo ""
echo "5. Connect your Phantom wallet and start trading!"
echo ""
echo "=================================="
echo "✨ Setup complete!"
echo ""
