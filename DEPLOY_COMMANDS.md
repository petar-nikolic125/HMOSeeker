# HMO Hunter - Deploy Komande za Hetzner

## 🚀 JEDNOSTAVAN DEPLOY (Preporučeno)

### 1. Na tvom Hetzner serveru pokreni:

```bash
# Obriši postojeće i kloniraj sve ispočetka
sudo rm -rf /var/www/hmo-hunter
sudo mkdir -p /var/www/hmo-hunter
cd /var/www/hmo-hunter

# Git clone sa tvojim repo URL-om
sudo git clone https://github.com/TVOJ-USERNAME/hmo-hunter.git .

# Podesi dozvole
sudo chown -R hmo:www-data /var/www/hmo-hunter
sudo chmod -R 755 /var/www/hmo-hunter

# Python biblioteke (Ubuntu način)
sudo apt update -qq
sudo apt install -y python3-requests python3-bs4 python3-lxml

# Node dependencies
npm ci --production --silent

# Build aplikacije  
npm run build

# Kreiranje cache direktorijuma
mkdir -p cache/primelocation
chmod -R 775 cache/

# Environment fajl
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=5000
CACHE_BASE_PATH=/var/www/hmo-hunter/cache
SESSION_SECRET=hmo-hunter-secret-key-$(date +%s)
PL_MAX_PAGES=12
PL_MIN_RESULTS=200
PL_CACHE_TTL_HOURS=12
REQUESTS_TIMEOUT=25
EOF

# Restart servisa
sudo systemctl daemon-reload
sudo systemctl restart hmo-hunter
sudo systemctl enable hmo-hunter

# Proveri status
systemctl status hmo-hunter
```

## 🔧 BACKUP NAČIN (ako gornji ne radi)

```bash
cd /var/www/hmo-hunter

# Kopiraj hetzner-deploy.sh i pokreni
./hetzner-deploy.sh https://github.com/TVOJ-USERNAME/hmo-hunter.git
```

## ✅ PROVERA DA LI RADI

```bash
# 1. Status servisa
systemctl status hmo-hunter

# 2. Health check
curl http://localhost:5000/health

# 3. Nginx status  
systemctl status nginx

# 4. Logovi ako ima problem
journalctl -u hmo-hunter --no-pager -n 20
```

## 🐛 AKO IMA PROBLEMA

### Python greška:
```bash
pip3 install --break-system-packages requests beautifulsoup4 lxml
```

### Build greška:
```bash
rm -rf node_modules
npm clean-install --production
npm run build
```

### Port zauzet:
```bash
sudo lsof -i :5000
sudo kill -9 PID_NUMBER
```

## 🔄 REDEPLOY POSLE IZMENA

```bash
cd /var/www/hmo-hunter
git pull origin main
npm run build  
sudo systemctl restart hmo-hunter
```

---
**Napomena**: Zameni `TVOJ-USERNAME` sa stvarnim GitHub username-om!