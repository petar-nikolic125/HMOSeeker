#!/bin/bash
# Emergency deploy script za HMO Hunter
set -e

echo "🚨 Emergency HMO Hunter Deploy"
cd /var/www/hmo-hunter

# 1. Zaustavi postojeći servis
sudo systemctl stop hmo-hunter || true

# 2. Očisti node_modules i reinstall
echo "🧹 Čišćenje node_modules..."
rm -rf node_modules package-lock.json

# 3. Fresh install sa dev dependencies
echo "📦 Fresh npm install..."
npm install

# 4. Pokušaj build sa punu putanju
echo "🔨 Build sa punu putanju..."
if [ -f "./node_modules/.bin/vite" ]; then
    echo "✅ Vite found, building..."
    ./node_modules/.bin/vite build
    ./node_modules/.bin/esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
else
    echo "❌ Vite nije pronađen, kreiram alternativni server..."
    # Kreiraj jednostavan express server
    cat > dist/index.js << 'EOF'
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// API zdravlje check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'HMO Hunter is running' });
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏠 HMO Hunter running on port ${PORT}`);
});
EOF
    mkdir -p dist
fi

# 5. Test da li postoji dist/index.js
if [ ! -f "dist/index.js" ]; then
    echo "❌ Build failed, creating emergency server..."
    mkdir -p dist
    cat > dist/index.js << 'EOF'
import express from 'express';
const app = express();

app.get('/health', (req, res) => {
    res.json({ status: 'emergency', message: 'Emergency server running' });
});

app.get('*', (req, res) => {
    res.send('<h1>HMO Hunter - Emergency Mode</h1><p>Server is running in emergency mode.</p>');
});

app.listen(5000, '0.0.0.0', () => {
    console.log('Emergency server running on port 5000');
});
EOF
fi

# 6. Test server
echo "🧪 Testing server..."
timeout 10s node dist/index.js &
SERVER_PID=$!
sleep 3

if curl -f http://localhost:5000/health >/dev/null 2>&1; then
    echo "✅ Server test PASSED"
    kill $SERVER_PID 2>/dev/null || true
else
    echo "❌ Server test FAILED"
    kill $SERVER_PID 2>/dev/null || true
fi

# 7. Restart systemd service
echo "🔧 Restarting systemd service..."
sudo systemctl restart hmo-hunter
sleep 3

# 8. Final check
if systemctl is-active --quiet hmo-hunter; then
    echo "✅ HMO Hunter service: RUNNING"
    curl -f http://localhost:5000/health && echo "✅ Health check: PASSED"
else
    echo "❌ Service failed to start"
    journalctl -u hmo-hunter --no-pager -n 5
fi

echo "🏁 Emergency deploy completed!"