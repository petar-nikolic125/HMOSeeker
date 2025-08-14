# HMO Hunter - Deployment to Hetzner Guide

## Step 1: Push Code to GitHub

1. Create a new repository on GitHub (if you don't have one)
2. In Replit, open the Shell and run these commands:

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit changes
git commit -m "HMO Hunter - Updated for Hetzner deployment"

# Add your GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/hmo-hunter.git

# Push to GitHub
git push -u origin main
```

## Step 2: Deploy to Hetzner

SSH to your Hetzner server and run the deployment script:

```bash
# Connect to your server
ssh root@46.62.166.201

# Run the deployment script
cd /var/www/hmo-hunter
./hetzner-deploy.sh https://github.com/YOUR_USERNAME/hmo-hunter.git

# Or if you have a domain:
./hetzner-deploy.sh https://github.com/YOUR_USERNAME/hmo-hunter.git yourdomain.com
```

## Step 3: Emergency Deploy (If Build Fails)

If the normal deployment fails, use the emergency script:

```bash
ssh root@46.62.166.201
cd /var/www/hmo-hunter
./emergency-deploy.sh
```

## Step 4: Check Status

After deployment, verify everything is working:

```bash
# Check service status
systemctl status hmo-hunter

# Check logs
journalctl -u hmo-hunter -f

# Test health endpoint
curl http://localhost:5000/health

# Check external access
curl http://46.62.166.201/health
```

## Step 5: Access Your Application

Your HMO Hunter will be available at:
- **Direct IP**: http://46.62.166.201
- **With domain**: https://yourdomain.com (if you configured SSL)

## Current Application Status

✅ **Backend**: Fully functional with 1,656 cached properties
✅ **API**: All endpoints working (London: 182 properties)
✅ **Cache System**: Active across all UK cities
✅ **Python Dependencies**: Auto-installing on startup
✅ **Build System**: Ready for production deployment

## Troubleshooting

If you encounter issues:

1. **Service not starting**: Check logs with `journalctl -u hmo-hunter -f`
2. **Build errors**: Use emergency deploy script
3. **Cache missing**: Cache will rebuild automatically when scraper runs
4. **Frontend not loading**: Check nginx configuration
5. **API errors**: Verify Python dependencies are installed

## Quick Commands for Updates

After making changes in Replit:

```bash
# Push to GitHub
git add . && git commit -m "Update" && git push

# Deploy to Hetzner
ssh root@46.62.166.201 "cd /var/www/hmo-hunter && git pull && npm run build && systemctl restart hmo-hunter"
```