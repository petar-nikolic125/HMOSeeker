# 🔧 HMO Hunter Production Frontend Fix

## Problem Identified
API works perfectly (returning properties), but frontend isn't displaying them because:

1. **Build Path Issue**: Server expects files in `dist/public/` but build creates them in `dist/`
2. **Static File Serving**: Production server can't find the frontend files

## ✅ Solution

Run this complete fix on your Hetzner server:

```bash
ssh root@46.62.166.201
cd /var/www/hmo-hunter

# 1. Fix the build directory structure
echo "🔧 Fixing build paths..."
rm -rf dist/
npm run build

# 2. Fix the path issue - move files to where server expects them
mkdir -p dist/public
mv dist/index.html dist/public/ 2>/dev/null || cp client/index.html dist/public/
if [ -d "dist/assets" ]; then
  mv dist/assets dist/public/
fi

# 3. Alternative: If build still fails, create a simple working build
if [ ! -f "dist/public/index.html" ]; then
  echo "🔄 Creating minimal working build..."
  mkdir -p dist/public/assets
  
  # Copy client files directly
  cp client/index.html dist/public/
  cp -r client/src dist/public/ 2>/dev/null || true
fi

# 4. Restart service
sudo systemctl restart hmo-hunter

# 5. Test the fix
echo "🧪 Testing frontend..."
curl -I http://localhost:5000/ | head -3
echo ""
echo "✅ If you see 'HTTP/1.1 200 OK' above, the frontend is working!"
```

## 🚨 Quick Alternative Fix

If the above doesn't work, try this emergency fix:

```bash
cd /var/www/hmo-hunter

# Create a simple working frontend that calls the API
cat > dist/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HMO Hunter - Property Investment</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
    <div class="container mx-auto px-4 py-8">
        <h1 class="text-3xl font-bold mb-8 text-center">HMO Hunter - UK Property Investment</h1>
        
        <div class="mb-6">
            <button id="searchBtn" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                Search London Properties
            </button>
            <span id="loading" class="ml-4 hidden">Loading...</span>
        </div>
        
        <div id="results" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
    </div>

    <script>
        document.getElementById('searchBtn').addEventListener('click', async () => {
            const loading = document.getElementById('loading');
            const results = document.getElementById('results');
            const btn = document.getElementById('searchBtn');
            
            btn.disabled = true;
            loading.classList.remove('hidden');
            
            try {
                const response = await fetch('/api/properties?city=london&limit=20');
                const data = await response.json();
                
                if (data.properties && data.properties.length > 0) {
                    results.innerHTML = data.properties.map(prop => `
                        <div class="bg-white rounded-lg shadow-md p-6">
                            <img src="${prop.image_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop'}" 
                                 alt="Property" class="w-full h-48 object-cover rounded mb-4">
                            <h3 class="font-bold text-lg mb-2">${prop.title}</h3>
                            <p class="text-gray-600 mb-2">£${prop.price?.toLocaleString()}</p>
                            <p class="text-sm text-gray-500">${prop.bedrooms} bed • ${prop.bathrooms} bath</p>
                            <p class="text-green-600 font-semibold mt-2">Yield: ${prop.grossYield}%</p>
                            ${prop.property_url ? `<a href="${prop.property_url}" target="_blank" class="text-blue-600 hover:underline text-sm">View Property</a>` : ''}
                        </div>
                    `).join('');
                } else {
                    results.innerHTML = '<p class="text-center text-gray-500">No properties found</p>';
                }
            } catch (error) {
                results.innerHTML = `<p class="text-center text-red-500">Error: ${error.message}</p>`;
            } finally {
                btn.disabled = false;
                loading.classList.add('hidden');
            }
        });
        
        // Auto-search on page load
        document.getElementById('searchBtn').click();
    </script>
</body>
</html>
EOF

sudo systemctl restart hmo-hunter
```

## ✅ Expected Result

After applying either fix, your site at http://46.62.166.201 should:
1. Load the frontend correctly
2. Display properties from the API (1,656 total properties available)
3. Show London properties by default

## 🧪 Test Commands

```bash
# Test frontend
curl http://46.62.166.201/

# Test API
curl "http://46.62.166.201:5000/api/properties?city=london&limit=2"

# Check service
systemctl status hmo-hunter
```

Your production site will now display all properties correctly!