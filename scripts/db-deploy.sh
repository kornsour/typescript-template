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

if [ -f .env ]; then
	# shellcheck disable=SC1091
	set -a && source .env && set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
	echo "→ Skipping DB migrations (DATABASE_URL not set)"
	exit 0
fi

echo "→ Applying pending DB migrations"
pnpm exec drizzle-kit migrate
