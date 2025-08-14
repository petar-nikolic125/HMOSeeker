#!/bin/bash
# Hetzner Cloud Complete Deployment Script za HMO Hunter
# Korisiti sa: ./hetzner-deploy.sh https://github.com/username/hmo-hunter.git

set -e

REPO_URL="$1"
DOMAIN="$2"

# Proveri parametre
if [ -z "$REPO_URL" ]; then
    echo "❌ Upotreba: ./hetzner-deploy.sh <git-repo-url> [domain.com]"
    echo "Primer: ./hetzner-deploy.sh https://github.com/username/hmo-hunter.git mydomain.com"
    exit 1
fi

echo "🚀 HMO Hunter - Hetzner Cloud Deployment"
echo "========================================"
echo "📥 Repo: $REPO_URL"
if [ ! -z "$DOMAIN" ]; then
    echo "🌐 Domain: $DOMAIN"
fi
echo ""

# 1. Očisti postojeći sadržaj
echo "🧹 Čišćenje postojećeg deployment-a..."
if [ -d "/var/www/hmo-hunter" ]; then
    # Backup cache ako postoji
    if [ -d "/var/www/hmo-hunter/cache" ]; then
        echo "💾 Backup cache-a..."
        sudo cp -r /var/www/hmo-hunter/cache /tmp/hmo-cache-backup-$(date +%Y%m%d_%H%M%S)
    fi
    sudo rm -rf /var/www/hmo-hunter/*
fi

# 2. Kreiranje strukture
echo "📁 Kreiranje deployment strukture..."
sudo mkdir -p /var/www/hmo-hunter
sudo mkdir -p /var/log/hmo-hunter
cd /var/www/hmo-hunter

# 3. Git clone koda
echo "📥 Kloniranje koda iz repositorije..."
sudo git clone "$REPO_URL" .

# 4. Podešavanje dozvola
echo "🔧 Podešavanje vlasništva i dozvola..."
sudo chown -R hmo:www-data /var/www/hmo-hunter
sudo chown -R hmo:www-data /var/log/hmo-hunter
sudo chmod -R 755 /var/www/hmo-hunter

# 5. Cache struktura
echo "📁 Kreiranje cache strukture..."
mkdir -p cache/primelocation
chmod -R 775 cache/

# Restore backup cache
BACKUP_CACHE=$(ls -td /tmp/hmo-cache-backup-* 2>/dev/null | head -1)
if [ ! -z "$BACKUP_CACHE" ] && [ -d "$BACKUP_CACHE" ]; then
    echo "🔄 Vraćam backup cache..."
    cp -r "$BACKUP_CACHE"/* cache/
    chmod -R 775 cache/
fi

# 6. Python dependencies (Ubuntu/Debian way)
echo "🐍 Instaliranje Python dependencies..."
sudo apt update -qq
sudo apt install -y python3 python3-pip python3-requests python3-bs4 python3-lxml || {
    echo "🔧 Fallback na pip install..."
    pip3 install --break-system-packages requests beautifulsoup4 lxml
}

# 7. Node.js dependencies
echo "📦 Instaliranje Node.js dependencies..."
npm ci --production --silent

# 8. Build aplikacije
echo "🔨 Building aplikacije..."
npm run build

# 9. Environment variables
echo "⚙️ Kreiranje production environment..."
cat > .env.production << EOF
NODE_ENV=production
PORT=5000
CACHE_BASE_PATH=/var/www/hmo-hunter/cache
SESSION_SECRET=hmo-hunter-$(openssl rand -hex 32)
PL_MAX_PAGES=12
PL_MIN_RESULTS=200
PL_CACHE_TTL_HOURS=12
REQUESTS_TIMEOUT=25
NODE_OPTIONS=--max-old-space-size=2048
EOF

# 10. SSL setup ako je domain dat
if [ ! -z "$DOMAIN" ]; then
    echo "🔒 Podešavanje SSL sertifikata..."
    # Update nginx config sa pravim domenom
    sudo sed -i "s/your-domain\.com/$DOMAIN/g" /etc/nginx/sites-available/hmo-hunter
    
    # Test nginx config
    sudo nginx -t && sudo systemctl reload nginx
    
    # Certbot za SSL
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN || {
        echo "⚠️ SSL setup neuspešan, nastavljam bez SSL-a..."
    }
fi

# 11. Systemd service
echo "🔧 Restart systemd servisa..."
sudo systemctl daemon-reload
sudo systemctl restart hmo-hunter
sudo systemctl enable hmo-hunter

# 12. Final checks
echo "🏁 Finalna provera sistema..."
sleep 5

# Service status
if systemctl is-active --quiet hmo-hunter; then
    echo "✅ HMO Hunter servis: RUNNING"
else
    echo "❌ HMO Hunter servis: FAILED"
    echo "📋 Poslednji logovi:"
    sudo journalctl -u hmo-hunter --no-pager -n 10
fi

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx: RUNNING"
else
    echo "❌ Nginx: FAILED"
fi

# Cache info
if [ -d "cache/primelocation" ]; then
    CACHE_CITIES=$(find cache/primelocation -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
    CACHE_SIZE=$(du -sh cache/ 2>/dev/null | cut -f1)
    echo "📊 Cache: $CACHE_CITIES gradova, $CACHE_SIZE ukupno"
fi

# Health check
echo "🏥 Health check..."
sleep 3
if curl -f http://localhost:5000/health >/dev/null 2>&1; then
    echo "✅ Server health check: PASSED"
else
    echo "⚠️ Server health check: FAILED"
fi

echo ""
echo "✅ DEPLOYMENT ZAVRŠEN!"
echo "==============================================="
echo "🌐 Aplikacija dostupna na:"
if [ ! -z "$DOMAIN" ]; then
    echo "   https://$DOMAIN"
else
    echo "   http://$(curl -s ifconfig.me):80"
fi
echo ""
echo "📊 Monitoring komande:"
echo "   systemctl status hmo-hunter"
echo "   journalctl -u hmo-hunter -f"
echo "   /home/hmo/monitor.sh"
echo ""
echo "🔄 Za redeploy:"
echo "   cd /var/www/hmo-hunter && git pull && npm run build && systemctl restart hmo-hunter"