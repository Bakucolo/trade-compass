# ==============================================================================
# Dockerfile: Trade Compass (Finance App)
# Multi-runtime container: Node.js 20 LTS + Python 3.11 LangGraph Agent + SQLite
# ==============================================================================

FROM node:20-bookworm-slim

WORKDIR /app

# 1. Install Linux packages (Python 3, pip, venv, sqlite3, curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    sqlite3 \
    curl \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# 2. Configure Python Virtualenv inside /app/.venv
RUN python3 -m venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# 3. Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 4. Install Node dependencies
COPY package*.json ./
RUN npm ci

# 5. Generate Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# 6. Copy application source code
COPY . .

# 7. Build Vite frontend for production
RUN npm run build

# 8. Set default production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL="file:./tradeflow.db?connection_limit=1&timeout=20000"

EXPOSE 3000

# 9. Start the 24/7 backend server
CMD ["npx", "tsx", "server/index.ts"]
