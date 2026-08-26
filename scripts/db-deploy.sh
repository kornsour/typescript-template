#!/usr/bin/env bash
#
# Applies pending Drizzle migrations before the production build, so schema
# changes ship with the code that needs them — no separate "remember to
# migrate" step. Wired into the `build` script (package.json).
#
# Never runs automatically. Plain local `pnpm build` and CI's build job (fake
# placeholder DATABASE_URL) must not attempt a migration, so this is a no-op
# unless FORCE_DB_MIGRATIONS=1 is set.
#
# On the AWS/SST target (ADR-0023) there is no build-time hook: `sst deploy`
# runs `next build` with FORCE_DB_MIGRATIONS unset, so this correctly skips
# there rather than migrating twice. The deploy workflow instead invokes this
# script as an explicit step with FORCE_DB_MIGRATIONS=1 *before* `sst deploy`,
# so the schema lands ahead of the code that needs it. See
# .github/workflows/deploy.yml and docs/adr/0023-aws-sst-deploy.md.
#
# Escape hatches:
#   SKIP_DB_MIGRATIONS=1   force-skip even when FORCE_DB_MIGRATIONS=1 (e.g. a
#                          hotfix deploy where you've already migrated by hand)
#   FORCE_DB_MIGRATIONS=1  force-run — set by the AWS deploy workflow, or
#                          locally to test the full deploy path against your
#                          local Postgres before pushing
#
# See docs/maintenance/database-migrations.md.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ "${SKIP_DB_MIGRATIONS:-}" = "1" ]; then
	echo "→ Skipping DB migrations (SKIP_DB_MIGRATIONS=1)"
	exit 0
fi

if [ "${FORCE_DB_MIGRATIONS:-}" != "1" ]; then
	echo "→ Skipping DB migrations (set FORCE_DB_MIGRATIONS=1 to run here — the AWS deploy workflow does exactly that)"
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
# Explicit migrator (scripts/db-migrate.ts): sets managed-Postgres TLS and
# prints the real error on failure, instead of drizzle-kit's opaque exit 1.
node scripts/db-migrate.mts
