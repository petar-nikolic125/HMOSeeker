#!/bin/bash

# Production Fix Script for HMO Hunter
# Copies cache data and deploys working server to Hetzner

echo "🚀 Fixing HMO Hunter production deployment..."

# Create production server with CommonJS
cat > /tmp/production-server.js << 'EOF'
const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Static files with proper MIME types
app.use(express.static(path.join(__dirname, 'dist/public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'HMO Hunter is running',
    timestamp: new Date().toISOString(),
    server: 'production'
  });
});

// Cache database class
class CacheDatabase {
  static async searchProperties(filters = {}) {
    try {
      const cacheDir = path.join(__dirname, 'cache', 'primelocation');
      console.log(`Loading cache from: ${cacheDir}`);
      
      let allProperties = [];
      const citiesToCheck = filters.city 
        ? [filters.city.toLowerCase().replace(/\s+/g, '-')]
        : ['london', 'birmingham', 'bristol', 'manchester'];
      
      for (const cityName of citiesToCheck) {
        const cityDir = path.join(cacheDir, cityName);
        
        try {
          const files = await fs.readdir(cityDir);
          console.log(`${cityName}: found ${files.length} files`);
          
          for (const file of files) {
            if (file.endsWith('.json') && !file.includes('.backup')) {
              try {
                const filePath = path.join(cityDir, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const data = JSON.parse(content);
                
                if (Array.isArray(data)) {
                  const propertiesWithCity = data.map(prop => ({
                    ...prop,
                    city: prop.city || cityName.replace('-', ' ')
                  }));
                  allProperties = allProperties.concat(propertiesWithCity);
                  console.log(`  ${file}: ${data.length} properties`);
                }
              } catch (err) {
                console.warn(`Failed to load ${file}:`, err.message);
              }
            }
          }
        } catch (err) {
          console.warn(`City ${cityName} not accessible:`, err.message);
        }
      }
      
      console.log(`Total properties loaded: ${allProperties.length}`);
      
      // Remove duplicates by property_url
      const unique = [];
      const seen = new Set();
      for (const prop of allProperties) {
        if (!seen.has(prop.property_url)) {
          seen.add(prop.property_url);
          unique.push(prop);
        }
      }
      
      console.log(`Unique properties: ${unique.length}`);
      
      // Apply filters
      let filtered = unique;
      
      if (filters.city && filters.city !== 'all') {
        filtered = filtered.filter(p => 
          p.city && p.city.toLowerCase().includes(filters.city.toLowerCase())
        );
      }
      
      if (filters.max_price && filters.max_price > 0) {
        filtered = filtered.filter(p => p.price && p.price <= filters.max_price);
      }
      
      if (filters.min_bedrooms && filters.min_bedrooms > 0) {
        filtered = filtered.filter(p => p.bedrooms && p.bedrooms >= filters.min_bedrooms);
      }
      
      if (filters.keywords) {
        const kw = filters.keywords.toLowerCase();
        filtered = filtered.filter(p => 
          (p.description && p.description.toLowerCase().includes(kw)) ||
          (p.address && p.address.toLowerCase().includes(kw))
        );
      }
      
      if (filters.postcode) {
        filtered = filtered.filter(p => 
          p.postcode && p.postcode.toLowerCase().includes(filters.postcode.toLowerCase())
        );
      }
      
      console.log(`After filters: ${filtered.length} properties`);
      return filtered;
      
    } catch (error) {
      console.error('Cache search error:', error);
      return [];
    }
  }
}

// API properties endpoint
app.get('/api/properties', async (req, res) => {
  try {
    const { city, max_price, min_bedrooms, postcode, keywords } = req.query;
    
    const parsePrice = (priceStr) => {
      if (!priceStr) return 0;
      const str = priceStr.toString().toLowerCase().trim();
      if (/^\d+$/.test(str)) return parseInt(str);
      if (str.includes('m')) return Math.round(parseFloat(str.replace(/[^\d.]/g, '')) * 1000000);
      if (str.includes('k')) return Math.round(parseFloat(str.replace(/[^\d.]/g, '')) * 1000);
      return parseInt(str.replace(/[^\d]/g, '')) || 0;
    };

    const filters = {};
    if (city && city !== 'all') filters.city = city.toString();
    if (max_price) filters.max_price = parsePrice(max_price);
    if (min_bedrooms) filters.min_bedrooms = parseInt(min_bedrooms);
    if (postcode) filters.postcode = postcode.toString();
    if (keywords) filters.keywords = keywords.toString();

    console.log(`API Search: ${JSON.stringify(filters)}`);
    
    const properties = await CacheDatabase.searchProperties(filters);
    
    // Transform for frontend
    const transformedProperties = properties.map((prop, index) => {
      const cityRentMap = {
        'london': 1000, 'birmingham': 580, 'bristol': 650, 'manchester': 600,
        'liverpool': 550, 'leeds': 600, 'sheffield': 500, 'cardiff': 550
      };
      
      const cityKey = (prop.city || '').toLowerCase().replace(/\s+/g, '');
      const rentPerBed = cityRentMap[cityKey] || 650;
      const estimatedRent = Math.max(400, (prop.bedrooms || 3) * rentPerBed);
      const grossYield = prop.price > 0 ? ((estimatedRent * 12) / prop.price) * 100 : 4.5;
      const roi = Math.max(0, grossYield - 3);
      
      return {
        id: `cache-${Date.now()}-${index}`,
        source: 'primelocation',
        title: prop.address || 'Property Listing',
        address: prop.address || '',
        price: prop.price || 0,
        bedrooms: prop.bedrooms || 0,
        bathrooms: prop.bathrooms || 0,
        description: prop.description || '',
        property_url: prop.property_url || '',
        image_url: prop.image_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop',
        listing_id: prop.listing_id || `cache-${index}`,
        postcode: prop.postcode || '',
        city: prop.city || filters.city || 'London',
        area_sqm: prop.area_sqm || null,
        article4_area: prop.article4_area || false,
        hmo_candidate: prop.hmo_candidate || true,
        created_at: prop.created_at || new Date().toISOString(),
        estimated_rental_yield: parseFloat(grossYield.toFixed(1)),
        estimated_monthly_rent: estimatedRent,
        grossYield: parseFloat(grossYield.toFixed(1)),
        monthlyRent: estimatedRent,
        roi: parseFloat(roi.toFixed(1))
      };
    });

    res.json({
      properties: transformedProperties,
      total: transformedProperties.length,
      cached: true,
      last_updated: new Date().toISOString()
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to load properties', 
      details: error.message 
    });
  }
});

// Cache stats endpoint
app.get('/api/cache/stats', async (req, res) => {
  try {
    const properties = await CacheDatabase.searchProperties();
    res.json({
      total_properties: properties.length,
      cities: [...new Set(properties.map(p => p.city).filter(Boolean))],
      cached: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏠 HMO Hunter production server running on port ${PORT}`);
  console.log(`📂 Cache directory: ${path.join(__dirname, 'cache', 'primelocation')}`);
});
EOF

echo "✅ Production server code created"

# Upload to server and deploy
echo "📤 Uploading to Hetzner server..."

# Note: You'll need to run these commands on the server manually or via SSH
echo "Run these commands on your server:"
echo ""
echo "# Stop current service"
echo "systemctl stop hmo-hunter"
echo ""
echo "# Copy cache data (if not already present)"
echo "cd /var/www/hmo-hunter"
echo "ls -la cache/primelocation/london/ | head -5"
echo ""
echo "# Copy the new server file"
echo "# (Copy the content from /tmp/production-server.js above)"
echo ""
echo "# Update systemd service to use CommonJS server"
echo "cp dist/index.js dist/index.js.backup"
echo "cp /tmp/production-server.js dist/index.js"
echo ""
echo "# Restart service"
echo "systemctl restart hmo-hunter"
echo "systemctl status hmo-hunter"
echo ""
echo "# Test endpoints"
echo "curl http://localhost:5000/health"
echo "curl 'http://localhost:5000/api/properties?city=london&max_price=500k'"
echo ""
echo "# Test from outside"
echo "curl http://46.62.166.201/"

echo "📋 Instructions saved. Please run these commands on your Hetzner server."