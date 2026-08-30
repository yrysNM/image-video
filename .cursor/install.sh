#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for the ImageToVideo Next.js app.
set -euo pipefail

cd "$(dirname "$0")/.."

# Provide a local .env if one is not already present. Real values supplied as
# Cloud Agent secrets (e.g. VIDEO_API_PROVIDER, VIDEO_API_KEY) are injected as
# environment variables and take precedence over these file defaults, so the
# app works out of the box with the keyless "mock" provider and switches to a
# real provider automatically once a key is configured.
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i 's/^VIDEO_API_PROVIDER=.*/VIDEO_API_PROVIDER=mock/' .env
fi

# Install dependencies from the lockfile (also runs `prisma generate` via the
# package.json postinstall hook).
npm ci

# Create/sync the SQLite database from the Prisma schema.
npx prisma db push
