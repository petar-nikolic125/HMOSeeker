#!/bin/bash
# Fix Tailwind CDN problem in production
set -e

echo "🎨 Fixing Tailwind CSS production issue..."

# 1. Remove any emergency HTML files that use CDN
if [ -f "dist/public/index.html" ]; then
    if grep -q "cdn.tailwindcss.com" dist/public/index.html; then
        echo "🧹 Removing emergency HTML with CDN..."
        rm -f dist/public/index.html
    fi
fi

# 2. Ensure proper build
echo "🔨 Running proper build..."
npm run build

# 3. Check if build created proper files
if [ ! -f "dist/public/index.html" ]; then
    echo "❌ Build didn't create dist/public/index.html"
    echo "🔧 Creating proper production HTML..."
    
    mkdir -p dist/public
    
    # Copy the proper client HTML (without CDN)
    cp client/index.html dist/public/index.html
    
    # Update paths for production
    sed -i 's|/src/main.tsx|/assets/main.js|g' dist/public/index.html
    
    # Remove development banner
    sed -i '/replit-dev-banner/d' dist/public/index.html
fi

# 4. Verify no CDN links remain
if grep -q "cdn.tailwindcss.com" dist/public/index.html; then
    echo "🚨 Still found CDN link! Removing it..."
    sed -i '/cdn.tailwindcss.com/d' dist/public/index.html
fi

# 5. Check for built CSS
if [ ! -f "dist/public/assets/main.css" ] && [ ! -f "dist/public/assets/index.css" ]; then
    echo "⚠️ No built CSS found, checking client build..."
    if [ -f "client/dist/assets/index.css" ]; then
        echo "📄 Copying CSS from client build..."
        mkdir -p dist/public/assets
        cp client/dist/assets/* dist/public/assets/ 2>/dev/null || true
    fi
fi

echo "✅ Tailwind fix completed!"
echo "📋 Verifying files:"
ls -la dist/public/
echo ""
echo "🔍 Checking for CDN references:"
grep -n "cdn.tailwindcss.com" dist/public/index.html && echo "❌ CDN still found!" || echo "✅ No CDN references found"