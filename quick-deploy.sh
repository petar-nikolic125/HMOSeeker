#!/bin/bash
# Quick deploy script for updating Hetzner from Replit

set -e

echo "🚀 HMO Hunter - Quick Deploy to Hetzner"
echo "======================================="

# Check if GitHub remote exists
if ! git remote get-url origin >/dev/null 2>&1; then
    echo "❌ GitHub remote not configured!"
    echo "Please run: git remote add origin https://github.com/YOUR_USERNAME/hmo-hunter.git"
    exit 1
fi

# Push to GitHub
echo "📤 Pushing to GitHub..."
git add .
git commit -m "Update from Replit - $(date '+%Y-%m-%d %H:%M:%S')" || echo "No changes to commit"
git push origin main

# Deploy to Hetzner
echo "🌐 Deploying to Hetzner server..."
SERVER_IP="46.62.166.201"

ssh root@$SERVER_IP << 'EOF'
cd /var/www/hmo-hunter
echo "📥 Pulling latest code..."
git pull origin main

echo "🔨 Building application..."
npm run build

echo "🔄 Restarting service..."
systemctl restart hmo-hunter

echo "✅ Deployment completed!"
sleep 3

# Health check
if curl -f http://localhost:5000/health >/dev/null 2>&1; then
    echo "✅ Health check: PASSED"
else
    echo "❌ Health check: FAILED"
    journalctl -u hmo-hunter --no-pager -n 5
fi
EOF

echo ""
echo "🏁 Deploy completed!"
echo "🌐 Your app: http://$SERVER_IP"
echo "🏥 Health check: http://$SERVER_IP/health"