#!/bin/bash
set -e

echo "🚀 Pokretam HMO Hunter deployment..."

# Proverava da li je u produkciji
if [ "$NODE_ENV" = "production" ]; then
    echo "📦 Production mode - instaliram dependencies..."
    npm ci --production --silent
else
    echo "🔧 Development mode - instaliram sve dependencies..."
    npm install
fi

# Backup postojećeg cache-a ako postoji
if [ -d "cache" ]; then
    echo "💾 Backup postojećeg cache-a..."
    cp -r cache cache_backup_$(date +%Y%m%d_%H%M%S) || echo "⚠️  Cache backup nije uspeo"
fi

# Instalira Python dependencies
echo "🐍 Instaliram Python dependencies..."
pip3 install -r requirements.txt 2>/dev/null || pip3 install requests beautifulsoup4 lxml

# Proverava cache direktorijum
echo "📁 Proveravam cache strukturu..."
mkdir -p cache/primelocation
chmod 775 cache/primelocation

# Build aplikacije
echo "🔨 Build aplikacije..."
npm run build

# Pokreće server u pozadini
if [ "$NODE_ENV" = "production" ]; then
    echo "🚀 Pokretam production server..."
    npm start &
    SERVER_PID=$!
    echo "Server PID: $SERVER_PID"
else
    echo "🔧 Development mode - pokreni sa 'npm run dev'"
fi

echo "✅ Deployment završen uspešno!"
echo "🌐 Server dostupan na portu 5000"
echo "📊 Cache direktorijum: cache/primelocation/"

# Proverava da li server radi (samo u produkciji)
if [ "$NODE_ENV" = "production" ]; then
    sleep 3
    if curl -f http://localhost:5000/health >/dev/null 2>&1; then
        echo "✅ Server health check prošao!"
    else
        echo "⚠️  Server health check nije prošao - proverite logove"
    fi
fi