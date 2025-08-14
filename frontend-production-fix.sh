#!/bin/bash
# Frontend production fix for HMO Hunter - API works but properties don't display
set -e

echo "🔧 Fixing frontend property display on production..."

cd /var/www/hmo-hunter

# 1. Check current build status
echo "📊 Current build status:"
ls -la dist/ 2>/dev/null || echo "❌ No dist directory"

# 2. Clean build - complete rebuild from scratch
echo "🧹 Clean rebuild..."
rm -rf dist/
rm -rf node_modules/
rm -f package-lock.json

# 3. Fresh install with all dependencies (including dev)
echo "📦 Fresh npm install..."
npm install

# 4. Check if we have the right source files
echo "📁 Checking source structure..."
if [ ! -f "client/src/pages/home.tsx" ]; then
    echo "❌ Frontend source files missing!"
    exit 1
else
    echo "✅ Frontend source files found"
fi

# 5. Fix potential build path issues - copy client/src to root src if needed
if [ -d "client/src" ] && [ ! -d "src" ]; then
    echo "🔄 Copying client/src to root src for Vite build..."
    cp -r client/src ./src
fi

# 6. Build with verbose output
echo "🔨 Building with verbose output..."
NODE_ENV=production npm run build || {
    echo "❌ Build failed! Trying alternative build..."
    
    # Alternative build approach
    echo "🔄 Trying alternative Vite build..."
    ./node_modules/.bin/vite build --outDir=dist/public || {
        echo "❌ Vite build also failed"
    }
}

# 7. Check if build created proper files
echo "📄 Checking build output..."
if [ -d "dist" ]; then
    echo "✅ Dist directory created"
    find dist -name "*.html" -o -name "*.js" -o -name "*.css" | head -5
    
    # Make sure index.html exists
    if [ ! -f "dist/index.html" ] && [ -f "client/index.html" ]; then
        echo "🔄 Copying index.html to dist..."
        cp client/index.html dist/
    fi
else
    echo "❌ Build failed completely"
    exit 1
fi

# 8. Test if static files are served correctly
echo "🌐 Testing static file serving..."
sudo systemctl restart hmo-hunter
sleep 3

# Test the frontend
FRONTEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000/")
if [ "$FRONTEND_TEST" = "200" ]; then
    echo "✅ Frontend serving correctly"
else
    echo "❌ Frontend not serving (HTTP $FRONTEND_TEST)"
fi

# 9. Test API endpoint that frontend uses
echo "🧪 Testing frontend API calls..."
API_RESPONSE=$(curl -s "http://localhost:5000/api/properties?city=London&min_bedrooms=3" | jq -r '.properties | length' 2>/dev/null || echo "error")
if [ "$API_RESPONSE" != "error" ] && [ "$API_RESPONSE" -gt "0" ]; then
    echo "✅ API returning $API_RESPONSE properties"
else
    echo "❌ API not returning properties correctly"
fi

# 10. Check for common frontend issues
echo "🔍 Checking for common issues..."

# Check if JavaScript is loading
if curl -s "http://localhost:5000/" | grep -q "script.*\.js"; then
    echo "✅ JavaScript files referenced in HTML"
else
    echo "❌ No JavaScript files found in HTML"
fi

# 11. Create a simple test page to verify frontend works
echo "🧪 Creating test page..."
cat > dist/test.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>HMO Hunter Test</title></head>
<body>
<h1>HMO Hunter Test Page</h1>
<div id="test-results"></div>
<script>
// Test API call
fetch('/api/properties?city=london&limit=2')
  .then(r => r.json())
  .then(data => {
    document.getElementById('test-results').innerHTML = 
      '<p>API Works! Found ' + (data.properties ? data.properties.length : 0) + ' properties</p>' +
      '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
  })
  .catch(e => {
    document.getElementById('test-results').innerHTML = 
      '<p style="color:red">API Error: ' + e.message + '</p>';
  });
</script>
</body>
</html>
EOF

# Test the test page
TEST_PAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000/test.html")
if [ "$TEST_PAGE_STATUS" = "200" ]; then
    echo "✅ Test page accessible at http://46.62.166.201/test.html"
    echo "   Visit this page to see if API calls work in browser"
else
    echo "❌ Test page not accessible"
fi

echo "🏁 Frontend fix completed!"
echo ""
echo "📋 Next steps:"
echo "1. Visit http://46.62.166.201/ to check the main site"
echo "2. Visit http://46.62.166.201/test.html to test API calls"
echo "3. Check browser console for any JavaScript errors (F12)"
echo "4. If still not working, check the server logs:"
echo "   journalctl -u hmo-hunter -f"