#!/bin/bash
# Production fix for HMO Hunter property display issue
set -e

echo "🔧 Fixing HMO Hunter property display issue..."

cd /var/www/hmo-hunter

# 1. Git pull to get the latest fixes
echo "📥 Pulling latest code..."
git pull origin main

# 2. Reinstall dependencies to be sure
echo "📦 Installing dependencies..."
npm ci --production

# 3. Rebuild the application
echo "🔨 Building application..."
npm run build

# 4. Check if cache directory exists and has properties
echo "📊 Checking cache status..."
if [ -d "cache/primelocation" ]; then
    echo "✅ Cache directory exists"
    CITY_COUNT=$(find cache/primelocation -type d -name "*" | grep -v primelocation | wc -l)
    echo "📁 Found $CITY_COUNT city directories"
    
    # Count total properties
    TOTAL_PROPS=0
    for city_dir in cache/primelocation/*/; do
        if [ -d "$city_dir" ]; then
            CITY_NAME=$(basename "$city_dir")
            PROP_COUNT=$(find "$city_dir" -name "*.json" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
            echo "  📄 $CITY_NAME: ~$PROP_COUNT lines in JSON files"
        fi
    done
else
    echo "❌ Cache directory missing! Creating..."
    mkdir -p cache/primelocation
    chmod 775 cache/
fi

# 5. Test the API locally
echo "🧪 Testing API endpoint..."
if curl -f "http://localhost:5000/health" >/dev/null 2>&1; then
    echo "✅ Health check: OK"
else
    echo "❌ Health check failed - server may not be running"
fi

# Test properties endpoint
if curl -f "http://localhost:5000/api/properties?city=london&limit=1" >/dev/null 2>&1; then
    echo "✅ Properties endpoint: OK"
    # Get actual count
    PROP_COUNT=$(curl -s "http://localhost:5000/api/properties?city=london" | jq -r '.count // 0' 2>/dev/null || echo "0")
    echo "📊 London properties in cache: $PROP_COUNT"
else
    echo "❌ Properties endpoint failed"
fi

# 6. Restart the service
echo "🔄 Restarting HMO Hunter service..."
sudo systemctl restart hmo-hunter

# 7. Wait a moment and check status
sleep 5

if systemctl is-active --quiet hmo-hunter; then
    echo "✅ Service restarted successfully"
    
    # Final API test
    if curl -f "http://localhost:5000/api/properties?city=london&limit=1" >/dev/null 2>&1; then
        echo "✅ Property display fix applied successfully!"
        echo "🌐 Your site should now display properties correctly"
    else
        echo "❌ Properties endpoint still failing after restart"
        echo "📋 Recent service logs:"
        journalctl -u hmo-hunter --no-pager -n 10
    fi
else
    echo "❌ Service failed to restart"
    echo "📋 Service logs:"
    journalctl -u hmo-hunter --no-pager -n 10
fi

echo "🏁 Production fix completed!"