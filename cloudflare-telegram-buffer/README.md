# Cloudflare Worker: Telegram Thought & Note Buffer

A lightweight, serverless Cloudflare Worker that acts as a webhook receiver for your Telegram Bot. It persistently stores incoming messages in **Cloudflare KV** until your local Trade Compass app wakes up and consumes them.

---

## 🚀 Quick Setup & Deployment Guide

### Step 1: Install Dependencies
Open a terminal in this directory (`cloudflare-telegram-buffer`):
```bash
npm install
```

### Step 2: Authenticate with Cloudflare
If you haven't logged in with wrangler:
```bash
npx wrangler login
```

### Step 3: Create the Cloudflare KV Namespace
Run the following command to create the KV store:
```bash
npx wrangler kv namespace create APP_BUFFER
```

It will output a block like:
```toml
[[kv_namespaces]]
binding = "APP_BUFFER"
id = "a1b2c3d4e5f67890abcdef1234567890"
```

Copy the `id` from the output and paste it into `wrangler.toml` under `[[kv_namespaces]]`:
```toml
[[kv_namespaces]]
binding = "APP_BUFFER"
id = "a1b2c3d4e5f67890abcdef1234567890"
```

### Step 4: Set Your Custom Consume Secret
Set a secret token used by your local app to authenticate when calling `/consume`:
```bash
npx wrangler secret put CONSUME_SECRET
```
*(Enter any strong random passphrase, e.g. `tradecompass_secret_consume_token_2026`)*

### Step 5: Deploy the Worker
```bash
npx wrangler deploy
```

Once deployed, Wrangler will print your live worker URL:
`https://telegram-thought-buffer.<your-subdomain>.workers.dev`

---

## 📱 Step 6: Link Your Telegram Bot (Exact Webhook Command)

Obtain your Telegram Bot API token from **@BotFather** on Telegram.
Run this `curl` command in your terminal to point Telegram at your Worker:

```bash
curl -F "url=https://telegram-thought-buffer.<your-subdomain>.workers.dev/webhook" \
     https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook
```

### Optional (Extra Security):
If you want to verify requests from Telegram using a secret token:
```bash
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```
And register the webhook with the secret token:
```bash
curl -F "url=https://telegram-thought-buffer.<your-subdomain>.workers.dev/webhook" \
     -F "secret_token=<YOUR_TELEGRAM_WEBHOOK_SECRET>" \
     https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook
```

---

## 🧪 Step 7: Test Your Webhook Buffer

1. Open Telegram and send a message to your bot:
   > `$NVDA looks primed for a bounce at $120. Look at buying 130C monthlies.`
2. In your terminal, test the `/consume` endpoint:
   ```bash
   curl -H "X-Consume-Secret: <YOUR_CONSUME_SECRET>" \
        https://telegram-thought-buffer.<your-subdomain>.workers.dev/consume
   ```
3. You will receive a JSON array containing your buffered message, and it will be deleted from the queue so it is never processed twice.

---

## 💻 Step 8: Configure in Your Local Finance App

Add the following to your `.env.local` in the root finance app directory:
```env
TELEGRAM_BUFFER_URL=https://telegram-thought-buffer.<your-subdomain>.workers.dev/consume
TELEGRAM_BUFFER_SECRET=tradecompass_secret_consume_token_2026
```

Your local app will automatically consume and save your thoughts into the **Log & Research Journal** whenever it boots up or runs periodic syncs!
