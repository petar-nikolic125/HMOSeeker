# HMO Hunter - Hetzner Cloud Deployment Guide

## 🚀 Brzi Deploy

### Korak 1: Kreiranje Hetzner Servera
1. Idi na Hetzner Cloud Console
2. Create New Server
3. Kopiraj cloud-config sadržaj iz `hetzner-cloud-config-final.yml`
4. Zameni SSH ključ i domain
5. Kreiraj server (minimum CX21 - 2 vCPU, 4GB RAM)

### Korak 2: Deployment na Serveru
```bash
# Konektuj se na server
ssh hmo@YOUR_SERVER_IP

# Skini deployment script
curl -O https://raw.githubusercontent.com/username/hmo-hunter/main/hetzner-deploy.sh
chmod +x hetzner-deploy.sh

# Pokreni deployment
./hetzner-deploy.sh https://github.com/username/hmo-hunter.git your-domain.com
```

## 🔧 Manuelni Deploy (ako script ne radi)

```bash
# 1. Pripremi direktorijum
sudo rm -rf /var/www/hmo-hunter
sudo mkdir -p /var/www/hmo-hunter
cd /var/www/hmo-hunter

# 2. Git clone
sudo git clone https://github.com/username/hmo-hunter.git .
sudo chown -R hmo:www-data /var/www/hmo-hunter

# 3. Python dependencies
sudo apt update
sudo apt install -y python3-requests python3-bs4 python3-lxml

# 4. Node dependencies i build
npm ci --production
npm run build

# 5. Environment
cat > .env.production << EOF
NODE_ENV=production
PORT=5000
CACHE_BASE_PATH=/var/www/hmo-hunter/cache
SESSION_SECRET=random-secret-key-here
EOF

# 6. Cache struktura
mkdir -p cache/primelocation
chmod 775 cache/

# 7. Pokreni servis
sudo systemctl restart hmo-hunter
sudo systemctl enable hmo-hunter
```

## ✅ Provera da li radi

```bash
# Status servisa
systemctl status hmo-hunter

# Logovi
journalctl -u hmo-hunter -f

# Health check
curl http://localhost:5000/health

# Nginx status
systemctl status nginx
```

## 🐛 Troubleshooting

### Problem: Python dependencies
```bash
pip3 install --break-system-packages requests beautifulsoup4 lxml
```

### Problem: Node build greške  
```bash
npm clean-install
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### Problem: Port 5000 zauzet
```bash
sudo lsof -i :5000
sudo kill -9 PID_BROJ
```

### Problem: Nginx ne radi
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 🔄 Redeploy Postupak

```bash
cd /var/www/hmo-hunter
git pull origin main
npm run build
sudo systemctl restart hmo-hunter
```

## 📊 Monitoring

```bash
# Sistem status
/home/hmo/monitor.sh

# Disk usage
df -h

# Memory usage
free -h

# Cache info
du -sh cache/
find cache/primelocation -type d | wc -l
```

## 🔒 SSL Setup (nakon deployment-a)

```bash
# Certbot SSL
sudo certbot --nginx -d your-domain.com
sudo systemctl reload nginx
```

## 📁 Struktura Fajlova na Serveru

```
/var/www/hmo-hunter/
├── cache/primelocation/     # JSON cache files
├── dist/                    # Built aplikacija  
├── server/                  # Backend kod
├── client/                  # Frontend kod
├── .env.production         # Environment variables
└── node_modules/           # Dependencies
```

## 🚨 Backup Postupak

```bash
# Cache backup
tar -czf hmo-cache-$(date +%Y%m%d).tar.gz cache/

# Full backup
rsync -av /var/www/hmo-hunter/ /backup/hmo-hunter/
```

Ovaj guide pokriva sve scenarije deployment-a na Hetzner Cloud serveru.