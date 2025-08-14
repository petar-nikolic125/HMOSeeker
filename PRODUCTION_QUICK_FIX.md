# 🔧 HMO Hunter - Production Quick Fix

## Problem
Properties not displaying on production server (backend working, frontend not showing data)

## Root Cause  
API endpoint was returning `listings` but frontend expects `properties` field.

## ✅ Quick Fix Solution

### Option 1: Run the automated fix script
```bash
# SSH to your Hetzner server
ssh root@46.62.166.201

# Download and run the fix
cd /var/www/hmo-hunter
wget https://raw.githubusercontent.com/yourusername/hmo-hunter/main/production-fix.sh
chmod +x production-fix.sh
./production-fix.sh
```

### Option 2: Manual fix steps
```bash
# SSH to your server
ssh root@46.62.166.201
cd /var/www/hmo-hunter

# 1. Pull latest code with the fix
git pull origin main

# 2. Rebuild
npm run build

# 3. Restart service
sudo systemctl restart hmo-hunter

# 4. Test
curl "http://localhost:5000/api/properties?city=london&limit=1"
```

## ✅ Expected Result
After applying the fix, your site should display properties correctly. The API now returns:
```json
{
  "success": true,
  "count": 182,
  "cached": true,
  "properties": [...]  // ← Fixed: was "listings" before
}
```

## 🧪 Test Commands
```bash
# Health check
curl http://localhost:5000/health

# Properties check 
curl "http://localhost:5000/api/properties?city=london&limit=2" | jq .

# Service status
systemctl status hmo-hunter
```

## 🎯 What was fixed
1. API response format: `listings` → `properties`
2. Added empty array handling for no results
3. Improved error handling and logging

Your HMO Hunter should now display all 1,656 cached properties correctly on production!