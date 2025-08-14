#!/bin/bash
# Simple deployment script for HMO Hunter - resolves vite PATH issues
set -e

echo "🚀 HMO Hunter - Simple Deploy (Fix vite PATH issue)"
echo "=================================================="

# 1. Setup git if needed
if [ ! -d ".git" ]; then
    echo "📥 Initial git setup..."
    cd ..
    rm -rf hmo-hunter
    git clone https://github.com/petar-nikolic125/HMOSeeker.git hmo-hunter
    cd hmo-hunter
else
    echo "📥 Updating code..."
    git fetch origin
    git reset --hard origin/main
fi

# 2. Python dependencies
echo "🐍 Installing Python dependencies..."
apt update -qq
apt install -y python3-requests python3-bs4 python3-lxml

# 3. Node dependencies with dev dependencies for build tools
echo "📦 Installing ALL Node.js dependencies (including dev for build)..."
npm install

# 4. Build with explicit paths to avoid PATH issues
echo "🔨 Building with explicit paths..."

# Build frontend with explicit vite path
echo "Building frontend..."
./node_modules/.bin/vite build

# Build backend with explicit esbuild path  
echo "Building backend..."
./node_modules/.bin/esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# 5. Create production environment
echo "⚙️ Setting up production environment..."
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=5000
CACHE_BASE_PATH=/var/www/hmo-hunter/cache
SESSION_SECRET=hmo-hunter-production-secret
EOF

# 6. Create cache structure
mkdir -p cache/primelocation
chmod -R 775 cache/

# 7. Create systemd service
echo "🔧 Creating systemd service..."
cat > /etc/systemd/system/hmo-hunter.service << 'EOF'
[Unit]
Description=HMO Hunter Property Analysis Platform
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/hmo-hunter
Environment=NODE_ENV=production
EnvironmentFile=/var/www/hmo-hunter/.env.production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=hmo-hunter

[Install]
WantedBy=multi-user.target
EOF

# 8. Setup nginx reverse proxy
echo "🌐 Setting up nginx..."
cat > /etc/nginx/sites-available/hmo-hunter << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # Proxy to Node.js app
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:5000/health;
        access_log off;
    }
}
EOF

# Enable nginx site
ln -sf /etc/nginx/sites-available/hmo-hunter /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t

# 9. Start services
echo "🚀 Starting services..."
systemctl daemon-reload
systemctl enable hmo-hunter
systemctl restart hmo-hunter
systemctl reload nginx

# 10. Wait and check status
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "📊 Service Status Check:"
if systemctl is-active --quiet hmo-hunter; then
    echo "✅ HMO Hunter service: RUNNING"
    SERVICE_STATUS="✅ RUNNING"
else
    echo "❌ HMO Hunter service: FAILED"
    SERVICE_STATUS="❌ FAILED"
    echo "Last 10 log lines:"
    journalctl -u hmo-hunter --no-pager -n 10
fi

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx: RUNNING"
    NGINX_STATUS="✅ RUNNING"
else
    echo "❌ Nginx: FAILED"
    NGINX_STATUS="❌ FAILED"
fi

# Health check
echo "🏥 Testing application health..."
if curl -f http://localhost:5000/health >/dev/null 2>&1; then
    echo "✅ Application health check: PASSED"
    HEALTH_STATUS="✅ PASSED"
else
    echo "❌ Application health check: FAILED"
    HEALTH_STATUS="❌ FAILED"
fi

# Cache info
if [ -d "cache/primelocation" ]; then
    CACHE_CITIES=$(find cache/primelocation -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
    CACHE_FILES=$(find cache/primelocation -name "*.json" 2>/dev/null | wc -l)
    CACHE_SIZE=$(du -sh cache/ 2>/dev/null | cut -f1)
    CACHE_INFO="📊 Cache: $CACHE_CITIES cities, $CACHE_FILES files, $CACHE_SIZE total"
else
    CACHE_INFO="📊 Cache: Not found - will be created on first scrape"
fi

# Final summary
echo ""
echo "✅ DEPLOYMENT SUMMARY"
echo "====================="
echo "HMO Hunter Service: $SERVICE_STATUS"
echo "Nginx Proxy: $NGINX_STATUS"  
echo "Health Check: $HEALTH_STATUS"
echo "$CACHE_INFO"
echo ""
echo "🌐 Application URL: http://$(curl -s ifconfig.me)"
echo ""
echo "📋 Useful commands:"
echo "   systemctl status hmo-hunter"
echo "   journalctl -u hmo-hunter -f"
echo "   curl http://localhost:5000/health"
echo ""
echo "🔄 To redeploy: cd /var/www/hmo-hunter && ./simple-deploy.sh"
echo ""