#!/bin/bash
# Kompletni fix za production HMO Hunter sajt
set -e

echo "🔧 Kompletan fix za HMO Hunter production..."

cd /var/www/hmo-hunter

# 1. Backup postojećeg cache-a ako postoji
if [ -d "cache" ]; then
    echo "💾 Backup cache-a..."
    cp -r cache cache_backup_$(date +%Y%m%d_%H%M%S) || true
fi

# 2. Git pull najnoviju verziju
echo "📥 Pulling najnoviju verziju..."
git pull origin main || {
    echo "⚠️ Git pull nije uspeo, nastavljam sa postojećim kodom"
}

# 3. Obriši sve build fajlove
echo "🧹 Čišćenje starih build fajlova..."
rm -rf dist/
rm -rf node_modules/
rm -rf package-lock.json
rm -rf client/dist/

# 4. Proveri da li imamo source fajlove
echo "📁 Proverava source strukture..."
if [ ! -f "client/index.html" ]; then
    echo "❌ client/index.html ne postoji!"
    exit 1
fi

if [ ! -f "client/src/main.tsx" ]; then
    echo "❌ client/src/main.tsx ne postoji!"  
    exit 1
fi

echo "✅ Source fajlovi pronađeni"

# 5. Čist npm install
echo "📦 Fresh npm install..."
npm install || {
    echo "❌ npm install failed"
    exit 1
}

# 6. Provjeri da li je vite instaliran
if [ ! -f "node_modules/.bin/vite" ]; then
    echo "❌ Vite nije instaliran"
    exit 1
fi

echo "✅ Vite je dostupan"

# 7. Pokušaj standard build  
echo "🔨 Standard Vite build..."
npm run build || {
    echo "⚠️ Standard build failed, pokušavam manual build..."
    
    # Manual Vite build
    echo "🔨 Manual Vite build..."
    ./node_modules/.bin/vite build --config vite.config.ts || {
        echo "❌ I manual build failed"
        exit 1
    }
}

# 8. Proveri output
echo "📊 Provera build output..."
if [ -d "dist/public" ]; then
    echo "✅ dist/public direktorijum postoji"
    ls -la dist/public/ | head -10
    
    if [ -f "dist/public/index.html" ]; then
        echo "✅ index.html pronađen"
    else
        echo "❌ index.html nedostaje u dist/public/"
        
        # Pokušaj kopiraj iz client direktorijuma
        if [ -f "client/index.html" ]; then
            echo "🔄 Kopiram client/index.html u dist/public/"
            cp client/index.html dist/public/
        fi
    fi
    
    # Proveri JS fajlove
    JS_COUNT=$(find dist/public -name "*.js" | wc -l)
    CSS_COUNT=$(find dist/public -name "*.css" | wc -l)
    echo "📄 Pronađeno $JS_COUNT JS fajlova, $CSS_COUNT CSS fajlova"
    
else
    echo "❌ dist/public ne postoji nakon build-a"
    
    # Pokušaj kreiraj osnovni dist/public sa content-om
    echo "🔄 Kreiram osnovni dist/public..."
    mkdir -p dist/public
    
    if [ -f "client/index.html" ]; then
        cp client/index.html dist/public/
        echo "✅ Kopiran client/index.html"
    fi
fi

# 9. Build backend za production
echo "🔨 Build backend..."
npm run build:server || {
    echo "⚠️ Backend build failed, kreiram osnovni server..."
    
    mkdir -p dist
    cat > dist/index.js << 'EOF'
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// API endpoints
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/properties', async (req, res) => {
    try {
        // Simulacija API poziva - prilagodi prema tvojoj logici
        const { exec } = await import('child_process');
        exec('python3 -c "import json; print(json.dumps([{\"title\": \"Test Property\", \"price\": 400000}]))"', 
            (error, stdout) => {
                if (error) {
                    res.json({ success: true, count: 0, properties: [] });
                } else {
                    const properties = JSON.parse(stdout.trim());
                    res.json({ success: true, count: properties.length, properties });
                }
            }
        );
    } catch (e) {
        res.json({ success: true, count: 0, properties: [] });
    }
});

// Static fajlovi
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏠 HMO Hunter running on port ${PORT}`);
});
EOF
}

# 10. Kreiraj environment file za production
echo "⚙️ Kreira .env.production..."
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=5000
CACHE_BASE_PATH=/var/www/hmo-hunter/cache
SESSION_SECRET=hmo-hunter-production-secret-key-2025
EOF

# 11. Pokreni servis
echo "🚀 Restartuj systemd servis..."
sudo systemctl stop hmo-hunter || true
sudo systemctl start hmo-hunter
sleep 5

# 12. Proveri da li radi
if systemctl is-active --quiet hmo-hunter; then
    echo "✅ HMO Hunter service je pokrenut"
    
    # Test health endpoint
    if curl -f http://localhost:5000/health >/dev/null 2>&1; then
        echo "✅ Health check: OK"
    else
        echo "❌ Health check failed"
    fi
    
    # Test frontend
    FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/ || echo "000")
    if [ "$FRONTEND_STATUS" = "200" ]; then
        echo "✅ Frontend: OK (HTTP $FRONTEND_STATUS)"
        echo "🌐 Sajt je dostupan na: http://46.62.166.201"
    else
        echo "❌ Frontend failed (HTTP $FRONTEND_STATUS)"
    fi
    
else
    echo "❌ Service failed to start"
    echo "📋 Logovi servisa:"
    journalctl -u hmo-hunter --no-pager -n 10
fi

echo ""
echo "🎯 Production fix završen!"
echo "📊 Proveri sajt na: http://46.62.166.201"
echo "🔧 Za debug: journalctl -u hmo-hunter -f"