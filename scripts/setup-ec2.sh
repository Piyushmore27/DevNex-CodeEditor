#!/bin/bash
# ════════════════════════════════════════════════════════════════
# DevFlow AI — EC2 Setup Script
# Run this ONCE on your EC2 instance (Ubuntu 22.04 recommended)
# 
# Usage: chmod +x setup-ec2.sh && sudo ./setup-ec2.sh
# ════════════════════════════════════════════════════════════════

set -e  # Exit on any error

echo "🚀 DevFlow AI EC2 Setup Starting..."

# ── 1. Update system ──────────────────────────────────────────────────────────
echo "📦 Updating system packages..."
apt-get update -y
apt-get upgrade -y

# ── 2. Install Node.js 20 ─────────────────────────────────────────────────────
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
echo "✅ Node.js $(node -v) installed"

# ── 3. Install Docker ─────────────────────────────────────────────────────────
echo "🐳 Installing Docker..."
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io

# Add current user to docker group (no sudo needed)
usermod -aG docker ubuntu
systemctl enable docker
systemctl start docker
echo "✅ Docker $(docker -v) installed"

# ── 4. Install Git ────────────────────────────────────────────────────────────
echo "📦 Installing Git..."
apt-get install -y git
echo "✅ Git $(git --version) installed"

# ── 5. Create Docker network for containers ───────────────────────────────────
echo "🌐 Creating Docker network..."
docker network create devflow-net 2>/dev/null || echo "Network already exists"

# ── 6. Create containers directory ───────────────────────────────────────────
echo "📁 Creating containers directory..."
mkdir -p /opt/devflow/containers
chown -R ubuntu:ubuntu /opt/devflow
echo "✅ Directory created: /opt/devflow/containers"

# ── 7. Configure firewall (ufw) ───────────────────────────────────────────────
echo "🔥 Configuring firewall..."
apt-get install -y ufw

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 5000/tcp  # DevFlow Backend
ufw allow 5173/tcp  # DevFlow Frontend (dev)
ufw allow 4000:5999/tcp  # User app containers

echo "y" | ufw enable
echo "✅ Firewall configured"

# ── 8. Install PM2 for process management ────────────────────────────────────
echo "📦 Installing PM2..."
npm install -g pm2
echo "✅ PM2 installed"

# ── 9. Install Nginx ─────────────────────────────────────────────────────────
echo "📦 Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx
echo "✅ Nginx installed"

# ── 10. Install node-pty build tools ─────────────────────────────────────────
echo "📦 Installing build tools for node-pty..."
apt-get install -y build-essential python3
echo "✅ Build tools installed"

# ── 11. Docker cleanup cron (remove old containers daily) ────────────────────
echo "⏰ Setting up Docker cleanup cron..."
cat > /etc/cron.daily/docker-cleanup << 'CRON'
#!/bin/bash
# Remove stopped containers older than 24 hours
docker container prune -f --filter "until=24h"
# Remove unused images older than 7 days
docker image prune -a -f --filter "until=168h"
echo "Docker cleanup done: $(date)"
CRON
chmod +x /etc/cron.daily/docker-cleanup
echo "✅ Cleanup cron set"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ EC2 Setup Complete!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Upload your DevFlow backend code to EC2"
echo "2. Create .env file with your credentials"
echo "3. Run: cd backend && npm install && pm2 start server.js --name devflow"
echo "4. Setup Nginx reverse proxy (see nginx/devflow.conf)"
echo ""
echo "Your EC2 Public IP:"
curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "(run 'curl ifconfig.me' to get IP)"
echo ""
