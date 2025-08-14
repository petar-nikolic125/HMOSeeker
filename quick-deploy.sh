#!/bin/bash
# Quick deploy script for HMO Hunter on existing Hetzner server
set -e

REPO_URL="https://github.com/petar-nikolic125/HMOSeeker.git"
DOMAIN="$1"

echo "🚀 HMO Hunter - Quick Deploy"
echo "============================="
echo "📥 Repo: $REPO_URL"
if [ ! -z "$DOMAIN" ]; then
    echo "🌐 Domain: $DOMAIN"
fi
echo ""

# 1. Backup existing cache if exists
echo "💾 Backup postojećeg cache-a..."
if [ -d "cache" ]; then
    cp -r cache /tmp/hmo-cache-backup-$(date +%Y%m%d_%H%M%S)
    echo "✅ Cache backed up"
fi

# 2. Git pull latest changes
echo "📥 Pulling latest code..."
git fetch origin
git reset --hard origin/main
git clean -fd

# 3. Restore cache
BACKUP_CACHE=$(ls -td /tmp/hmo-cache-backup-* 2>/dev/null | head -1)
if [ ! -z "$BACKUP_CACHE" ] && [ -d "$BACKUP_CACHE" ]; then
    echo "🔄 Restoring cache..."
    cp -r "$BACKUP_CACHE"/* cache/ 2>/dev/null || mkdir -p cache/primelocation
    chmod -R 775 cache/
fi

# 4. Python dependencies
echo "🐍 Installing Python dependencies..."
apt update -qq
apt install -y python3-requests python3-bs4 python3-lxml || {
    pip3 install --break-system-packages requests beautifulsoup4 lxml
}

# 5. Node dependencies and build
echo "📦 Installing Node.js dependencies..."
npm ci --production --silent

echo "🔨 Building application..."
npm run build

# 6. Environment setup
echo "⚙️ Setting up environment..."
cat > .env.production << EOF
NODE_ENV=production
PORT=5000
CACHE_BASE_PATH=/var/www/hmo-hunter/cache
SESSION_SECRET=hmo-hunter-$(openssl rand -hex 16)
PL_MAX_PAGES=12
PL_MIN_RESULTS=200
PL_CACHE_TTL_HOURS=12
REQUESTS_TIMEOUT=25
NODE_OPTIONS=--max-old-space-size=2048
EOF

# 7. Fix permissions
chown -R www-data:www-data /var/www/hmo-hunter
chmod -R 755 /var/www/hmo-hunter
chmod -R 775 /var/www/hmo-hunter/cache

# 8. Restart services
echo "🔧 Restarting services..."
systemctl restart hmo-hunter 2>/dev/null || {
    echo "📋 Creating systemd service..."
    
    cat > /etc/systemd/system/hmo-hunter.service << EOF
[Unit]
Description=HMO Hunter Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/hmo-hunter
Environment=NODE_ENV=production
EnvironmentFile=/var/www/hmo-hunter/.env.production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=hmo-hunter
KillMode=mixed
KillSignal=SIGINT
TimeoutStopSec=5

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable hmo-hunter
    systemctl start hmo-hunter
}

# 9. Setup nginx if not exists
if [ ! -f "/etc/nginx/sites-enabled/hmo-hunter" ]; then
    echo "🌐 Setting up nginx..."
    
    cat > /etc/nginx/sites-available/hmo-hunter << EOF
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    ln -sf /etc/nginx/sites-available/hmo-hunter /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
fi

# 10. Final checks
echo "🏥 Final health checks..."
sleep 5

if systemctl is-active --quiet hmo-hunter; then
    echo "✅ HMO Hunter service: RUNNING"
else
    echo "❌ HMO Hunter service: FAILED"
    journalctl -u hmo-hunter --no-pager -n 10
fi

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx: RUNNING"
else
    echo "❌ Nginx: FAILED"
fi

# Health check
if curl -f http://localhost:5000/health >/dev/null 2>&1; then
    echo "✅ Application health check: PASSED"
else
    echo "⚠️ Application health check: FAILED"
fi

# Cache info
if [ -d "cache/primelocation" ]; then
    CACHE_CITIES=$(find cache/primelocation -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
    CACHE_SIZE=$(du -sh cache/ 2>/dev/null | cut -f1)
    echo "📊 Cache: $CACHE_CITIES cities, $CACHE_SIZE total"
fi

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "========================"
echo "🌐 Application available at: http://$(curl -s ifconfig.me)"
echo ""
echo "📊 Monitoring commands:"
echo "   systemctl status hmo-hunter"
echo "   journalctl -u hmo-hunter -f"
echo ""