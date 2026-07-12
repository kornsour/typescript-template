#!/usr/bin/env bash
#
# Applies pending Drizzle migrations before the production build, so schema
# changes ship with the code that needs them — no separate "remember to
# migrate" step. Wired into the `build` script (package.json).
#
# Only runs automatically on Vercel (where DATABASE_URL is a real,
# already-migrated-toward preview/prod database and env vars are injected
# directly into the process, no .env file involved). Everywhere else — plain
# local `pnpm build`, CI's placeholder-DB build — it's a no-op by default so
# those don't require a live database.
#
# Escape hatches:
#   SKIP_DB_MIGRATIONS=1   force-skip, even on Vercel (e.g. a hotfix build
#                          where you've already migrated by hand)
#   FORCE_DB_MIGRATIONS=1  force-run locally, to test the full deploy path
#                          against your local Postgres before pushing
#
# See docs/maintenance/database-migrations.md.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ "${SKIP_DB_MIGRATIONS:-}" = "1" ]; then
	echo "→ Skipping DB migrations (SKIP_DB_MIGRATIONS=1)"
	exit 0
fi

if [ -z "${VERCEL:-}" ] && [ "${FORCE_DB_MIGRATIONS:-}" != "1" ]; then
	echo "→ Skipping DB migrations (not a Vercel build; set FORCE_DB_MIGRATIONS=1 to run locally)"
	exit 0
fi

# Only source a local .env OUTSIDE Vercel (the FORCE_DB_MIGRATIONS local-test
# path). On Vercel, env vars are injected into the process directly — sourcing a
# stray uploaded .env would let its development DATABASE_URL (localhost) override
# the platform-injected one, and migrations would fail against 127.0.0.1:5432.
# .vercelignore also keeps .env* out of the upload; this is defense in depth.
if [ -z "${VERCEL:-}" ] && [ -f .env ]; then
	# shellcheck disable=SC1091
	set -a && source .env && set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
	echo "→ Skipping DB migrations (DATABASE_URL not set)"
	exit 0
fi

echo "→ Applying pending DB migrations"
# Explicit migrator (scripts/db-migrate.ts): sets managed-Postgres TLS and
# prints the real error on failure, instead of drizzle-kit's opaque exit 1.
node scripts/db-migrate.mts
