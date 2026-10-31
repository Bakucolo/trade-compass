#!/usr/bin/env bash
set -e

echo "🚀 [Deploy] Starting Trade Compass deployment..."

# Navigate to project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "📂 [Deploy] Project directory: $(pwd)"

echo "📥 [Deploy] Fetching latest changes from origin/main..."
git fetch origin main
git reset --hard origin/main

# Detect docker compose variant
if docker compose version &> /dev/null; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
  COMPOSE_CMD="docker-compose"
else
  echo "❌ Error: Neither 'docker compose' nor 'docker-compose' found on system."
  exit 1
fi

echo "🐳 [Deploy] Rebuilding and launching containers with $COMPOSE_CMD..."
$COMPOSE_CMD up -d --build

echo "🧹 [Deploy] Pruning old/dangling Docker images to save disk space..."
docker image prune -f || true

echo "📋 [Deploy] Current container status:"
$COMPOSE_CMD ps

echo "🎉 [Deploy] Trade Compass deployed successfully!"
