# 100% Free Cloud Deployment Guide ($0 Forever)
## Trade Compass (Finance App)

This guide walks you through setting up your **100% free cloud instance** so your Trade Compass app and Telegram bot run 24/7 without needing your laptop powered on.

---

### Prerequisites: What is 100% Free Forever
- **Cloud VM**: Oracle Cloud "Always Free" Compute (up to 4 ARM vCPUs, 24 GB RAM, 200 GB persistent storage) OR Google Cloud Platform (GCP) Always Free `e2-micro`.
- **Domain & Routing**: Cloudflare Pages (Frontend, $0) + Cloudflare Tunnel (`cloudflared`, $0).
- **Telegram Buffer**: Cloudflare Workers + KV (`telegram-thought-buffer`, $0 - already running!).

---

### Step 1: Create your Free Oracle Cloud Always-Free VM

1. Go to [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) and sign up for an **Always Free** account.
2. In the Oracle Cloud Console, navigate to **Compute > Instances > Create Instance**.
3. Configure the instance:
   - **Name**: `trade-compass-cloud`
   - **Image**: **Ubuntu 24.04 Minimal** or **Ubuntu 22.04 LTS**
   - **Shape**: 
     - Option A: **Ampere ARM (VM.Standard.A1.Flex)** — Select **2 to 4 OCPUs** and **12 to 24 GB RAM** (100% Free!).
     - Option B: **AMD (VM.Standard.E2.1.Micro)** — 1 OCPU, 1 GB RAM (Always Free).
   - **SSH Keys**: Download and save your Private Key to your computer.
4. Click **Create**. Within 60 seconds, your instance is running with a Public IP.

---

### Step 2: Connect to your Server and Install Docker

Open PowerShell or Terminal on your computer and connect to your instance:
```bash
ssh -i /path/to/your-private-key.key ubuntu@<YOUR_SERVER_PUBLIC_IP>
```

Run this one-liner to install Docker and Docker Compose:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER
newgrp docker
```

---

### Step 3: Clone Trade Compass and Set Up Secrets

1. Clone your repository:
```bash
git clone https://github.com/Bakucolo/trade-compass.git
cd trade-compass
```

2. Copy your `.env.local` configuration:
```bash
nano .env.local
```
*(Paste your environment variables: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_BUFFER_URL`, `TASTYTRADE_*`, `TRADING212_*`, `OPENROUTER_API_KEY`, etc. and press `Ctrl+O`, `Enter`, `Ctrl+X` to save).*

---

### Step 4: Launch the 24/7 Cloud App

Run Docker Compose:
```bash
docker compose up -d --build
```

Verify that the app is running:
```bash
docker compose ps
docker compose logs -f trade-compass
```

The app is now running 24/7 in the cloud!
- The backend API and Web UI are available on port `3000`.
- All background daemons (Telegram buffer consumer every 15s, Trading 212 sync every 45s, stale holdings cleanup, quotes warmup) run continuously.
- SQLite (`tradeflow.db`) is safely persisted in the Docker volume.

---

### Step 5: (Optional) Secure HTTPS with Cloudflare Tunnel ($0)

To access your app securely from your phone or browser without opening any ports on your server:

1. In your Cloudflare Dashboard, go to **Zero Trust > Networks > Tunnels > Create a Tunnel**.
2. Name it `trade-compass-tunnel` and select **Docker**.
3. Cloudflare will give you a run command containing a token:
```bash
docker run -d --name cloudflared --restart unless-stopped cloudflare/cloudflared:latest tunnel --no-autoupdate run --token <YOUR_TOKEN>
```
4. In Cloudflare Tunnel settings, map your public hostname (e.g. `app.yourdomain.com`) to:
   - **Service**: `http://localhost:3000`
5. You can now access your live app anywhere at `https://app.yourdomain.com` with free, enterprise-grade Cloudflare SSL and DDoS protection!
