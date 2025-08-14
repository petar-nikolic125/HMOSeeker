#!/bin/bash
set -e

echo "🚀 HMO Hunter Production Deployment..."

# Promenljive
REPO_URL="$1"
if [ -z "$REPO_URL" ]; then
    echo "❌ Greška: Nisu git repo URL"
    echo "Upotreba: ./production-deploy.sh https://github.com/username/repo.git"
    exit 1
fi

# Backup postojećeg direktorijuma ako postoji
if [ -d "/var/www/hmo-hunter" ] && [ "$(ls -A /var/www/hmo-hunter)" ]; then
    echo "💾 Backup postojećeg deployment-a..."
    sudo mv /var/www/hmo-hunter /var/www/hmo-hunter-backup-$(date +%Y%m%d_%H%M%S)
fi

# Kreiranje direktorijuma
echo "📁 Kreiram deployment direktorijum..."
sudo mkdir -p /var/www/hmo-hunter
cd /var/www/hmo-hunter

# Git clone
echo "📥 Kloniram kod iz GitHub-a..."
sudo git clone "$REPO_URL" .

# Promena vlasništva
echo "🔧 Podešavam dozvole..."
sudo chown -R hmo:www-data /var/www/hmo-hunter
sudo chmod -R 755 /var/www/hmo-hunter

# Python dependencies preko apt
echo "🐍 Instaliram Python dependencies..."
sudo apt update -qq
sudo apt install -y python3-requests python3-bs4 python3-lxml python3-pip

# Backup i kreiranje cache strukture
echo "📁 Kreiranje cache strukture..."
mkdir -p cache/primelocation
chmod 775 cache/

# Restore backup cache ako postoji
BACKUP_DIR=$(ls -td /var/www/hmo-hunter-backup-* 2>/dev/null | head -1)
if [ ! -z "$BACKUP_DIR" ] && [ -d "$BACKUP_DIR/cache" ]; then
    echo "🔄 Vraćam postojeći cache..."
    cp -r "$BACKUP_DIR/cache/" ./
    chmod -R 775 cache/
fi

# Node.js dependencies i build
echo "📦 Instaliram Node.js dependencies..."
npm ci --production --silent

echo "🔨 Build aplikacije..."
npm run build

# Environment fajl
echo "⚙️  Kreiranje .env.production..."
cat > .env.production << EOF
NODE_ENV=production
PORT=5000
CACHE_BASE_PATH=/var/www/hmo-hunter/cache
SESSION_SECRET=hmo-hunter-super-secret-$(openssl rand -hex 32)
PL_MAX_PAGES=12
PL_MIN_RESULTS=200
PL_CACHE_TTL_HOURS=12
REQUESTS_TIMEOUT=25
NODE_OPTIONS=--max-old-space-size=2048
EOF

# Podešavanje systemd servisa
echo "🔧 Pokretanje HMO Hunter servisa..."
sudo systemctl restart hmo-hunter || {
    echo "⚠️  Servis nije mogao da se pokrene, proveravam status..."
    sudo systemctl status hmo-hunter --no-pager
}

# Restart nginx
echo "🌐 Restart Nginx..."
sudo nginx -t && sudo systemctl reload nginx

# Finalne provere
echo "🏁 Finalne provere..."
sleep 5

if systemctl is-active --quiet hmo-hunter; then
    echo "✅ HMO Hunter servis: RUNNING"
else
    echo "❌ HMO Hunter servis: STOPPED"
    sudo journalctl -u hmo-hunter --no-pager -n 10
fi

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx: RUNNING"
else
    echo "❌ Nginx: STOPPED"
fi

# Cache info
if [ -d "cache/primelocation" ]; then
    CACHE_CITIES=$(find cache/primelocation -mindepth 1 -maxdepth 1 -type d | wc -l)
    CACHE_SIZE=$(du -sh cache/ | cut -f1)
    echo "📊 Cache: $CACHE_CITIES cities, $CACHE_SIZE total"
fi

echo ""
echo "✅ DEPLOYMENT ZAVRŠEN!"
echo "🌐 Aplikacija dostupna na https://your-domain.com"
echo "📊 Monitoring: /home/hmo/monitor.sh"
echo "🔄 Za redeploy: cd /var/www/hmo-hunter && git pull && NODE_ENV=production ./deploy.sh"