# BRZI FIX ZA HETZNER DEPLOYMENT

## Problem identifikovan: 
- `vite` komanda nije u PATH-u iako su dependencies instalirane
- Servis pokušava `npm start` ali `dist/index.js` ne postoji jer build nije uspeo

## ODMAH POKRENI OVE KOMANDE:

```bash
cd /var/www/hmo-hunter

# 1. Proveri da li je vite instaliran
ls -la node_modules/.bin/ | grep vite

# 2. Ako postoji vite, koristi punu putanju
./node_modules/.bin/vite build

# 3. Ako ne radi, forsiramo reinstall sa dev dependencies
rm -rf node_modules package-lock.json
npm install

# 4. Pokušaj build ponovo
npm run build

# 5. Alternativno - manuelni build
./node_modules/.bin/vite build
./node_modules/.bin/esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# 6. Proveri da li je build uspeo
ls -la dist/

# 7. Test pokretanja
node dist/index.js

# 8. Ako radi, restart servisa
sudo systemctl restart hmo-hunter
```

## BACKUP PLAN - Simple Static Server:

Ako build i dalje ne radi, koristićemo jednostavan static file server:

```bash
# Kreiraj jednostavan server bez build-a
cat > simple-server.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static('client'));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.listen(5000, '0.0.0.0', () => {
    console.log('HMO Hunter running on port 5000');
});
EOF

# Pokreni jednostavan server
node simple-server.js
```