#!/usr/bin/env sh
# Render start script: migrate via DIRECT_DB_URL, then run API.
set -e

if [ -z "$DIRECT_DB_URL" ] && [ -z "$DATABASE_URL" ]; then
  echo "ERROR: Set DATABASE_URL (Neon pooler) and/or DIRECT_DB_URL (Neon direct)."
  echo "See helperdocs/RENDER_NEON_DEPLOY.md"
  exit 1
fi

if [ -z "$DIRECT_DB_URL" ]; then
  echo "Note: DIRECT_DB_URL unset — migrate will use direct URL derived from DATABASE_URL (-pooler stripped)."
fi

echo "Running prisma migrate deploy..."
npx prisma migrate deploy

echo "Starting API..."
exec node dist/main.js
