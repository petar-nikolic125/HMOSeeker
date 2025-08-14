# HMO Hunter - Hetzner Deployment Guide

## Pre-Deployment Setup

### 1. Domain Configuration
- Point your domain A record to your Hetzner server IP
- Wait for DNS propagation (use `dig your-domain.com` to check)

### 2. SSH Key Setup
Replace `YOUR_SSH_PUBLIC_KEY_HERE` in the cloud-config with your actual SSH public key:
```bash
# Generate SSH key if you don't have one
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# Copy public key
cat ~/.ssh/id_rsa.pub
```

### 3. Database Setup
- Set up a PostgreSQL database (Hetzner Cloud SQL, DigitalOcean, or Neon)
- Update the DATABASE_URL in the cloud-config

## Deployment Steps

### 1. Create Hetzner Server
- Choose Ubuntu 22.04 LTS
- Minimum: 2 vCPUs, 4GB RAM, 40GB SSD
- Paste the cloud-config content
- Select your SSH key
- Create server

### 2. Initial Server Access
```bash
# Connect to server
ssh hmo@YOUR_SERVER_IP

# Check if setup completed
sudo systemctl status hmo-hunter
```

### 3. Deploy Your Code
```bash
# Clone your repository
cd /var/www/hmo-hunter
git clone https://github.com/your-username/hmo-hunter.git .

# Set up environment
cp .env.production .env

# Install and build
npm ci --production
npm run build

# Start service
sudo systemctl start hmo-hunter
sudo systemctl status hmo-hunter
```

### 4. SSL Certificate Setup
```bash
# Install SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### 5. Verify Deployment
- Visit https://your-domain.com
- Check API: https://your-domain.com/health
- Test property search functionality

## Maintenance Commands

### View Logs
```bash
# Application logs
sudo journalctl -u hmo-hunter -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Update Application
```bash
# Use the deployment script
/home/hmo/deploy.sh
```

### Monitor Resources
```bash
# System status
htop

# Service status
sudo systemctl status hmo-hunter nginx postgresql
```

## Security Features Included

- **Firewall**: UFW configured with minimal open ports
- **Fail2Ban**: Protection against brute force attacks  
- **SSL/TLS**: Automatic HTTPS with Let's Encrypt
- **Security Headers**: HSTS, XSS protection, content security policy
- **Service Isolation**: Application runs as non-root user
- **System Hardening**: Read-only file system protections

## Performance Optimizations

- **Gzip Compression**: Reduces bandwidth usage
- **Static Asset Caching**: 1-year cache for images/CSS/JS
- **Process Management**: Automatic restart on failure
- **Resource Limits**: Systemd service constraints

Your HMO Hunter platform will be production-ready with automatic scaling and monitoring!