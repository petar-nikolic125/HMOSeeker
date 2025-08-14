#!/bin/bash
# Debug production frontend issue - API works but frontend doesn't display
set -e

echo "🔍 Debugging HMO Hunter frontend on production..."

cd /var/www/hmo-hunter

# 1. Check if the frontend is being served correctly
echo "📄 Checking frontend build..."
if [ -f "dist/index.html" ] || [ -f "client/dist/index.html" ]; then
    echo "✅ Frontend build files exist"
    ls -la dist/ 2>/dev/null || ls -la client/dist/ 2>/dev/null || echo "No dist directory found"
else
    echo "❌ Frontend build missing!"
fi

# 2. Check server static file serving
echo "🌐 Testing static file serving..."
curl -I "http://localhost:5000/" | head -5

# 3. Check for JavaScript errors in the built files
echo "📜 Checking for build issues..."
if [ -f "dist/assets/"*.js ]; then
    echo "✅ JavaScript bundles found"
    ls -la dist/assets/*.js 2>/dev/null | head -3
else
    echo "❌ No JavaScript bundles found"
fi

# 4. Test the exact frontend API call
echo "🧪 Testing frontend API call format..."
# Simulate the exact call the frontend makes
RESPONSE=$(curl -s "http://localhost:5000/api/properties?city=London&min_bedrooms=3")
echo "Response length: $(echo $RESPONSE | wc -c)"
echo "Properties count: $(echo $RESPONSE | jq -r '.properties | length' 2>/dev/null || echo 'Could not parse')"

# 5. Check for CORS issues
echo "🔒 Checking CORS headers..."
curl -I -H "Origin: http://46.62.166.201" "http://localhost:5000/api/properties?city=london&limit=1" | grep -i cors || echo "No CORS headers found"

# 6. Check if frontend code has the correct API endpoint
echo "📁 Checking frontend API configuration..."
if [ -f "client/src/lib/queryClient.ts" ]; then
    grep -n "baseURL\|localhost\|46.62.166.201" client/src/lib/queryClient.ts || echo "No base URL config found"
fi

# 7. Check for console errors in the build
echo "🕷️ Checking for potential runtime issues..."
if [ -f "dist/assets/"*.js ]; then
    # Look for common error patterns in built JS
    grep -l "console.error\|throw new Error" dist/assets/*.js 2>/dev/null | head -2 || echo "No obvious errors in built files"
fi

# 8. Test health and properties endpoint with exact frontend parameters
echo "🎯 Testing with exact frontend parameters..."
curl -s "http://localhost:5000/api/properties?city=London&minRooms=3&hmo_candidate=false&article4_filter=all" | jq -r '.count // "No count found"'

echo "🏁 Debug completed! Check the output above for issues."