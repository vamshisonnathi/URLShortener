#!/bin/sh
set -e

# Apply committed migrations before the app boots. `migrate deploy` is
# idempotent and safe to run on every container start.
echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting server..."
exec "$@"
