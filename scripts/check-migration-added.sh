#!/usr/bin/env bash
#
# CI guard: fails if src/db/schema.ts changed without a matching drizzle/
# migration. This is the #1 cause of schema drift — someone edits the schema,
# forgets `pnpm db:generate`, and prod never gets the change (or a later
# migration is generated against a base it doesn't match).
#
# Usage: check-migration-added.sh <base-ref>   (e.g. origin/main)
#
# See docs/maintenance/database-migrations.md.
set -euo pipefail

BASE="${1:?usage: check-migration-added.sh <base-ref>}"

CHANGED="$(git diff --name-only "${BASE}...HEAD")"

if ! grep -qx "src/db/schema.ts" <<<"$CHANGED"; then
	echo "✓ src/db/schema.ts unchanged — no migration required."
	exit 0
fi

if grep -q "^drizzle/" <<<"$CHANGED"; then
	echo "✓ src/db/schema.ts changed and a matching drizzle/ migration was added."
	exit 0
fi

cat <<'EOF'
❌ src/db/schema.ts changed but no migration file was added under drizzle/.

Run:
  pnpm db:generate --name <descriptive_name>

then commit the generated drizzle/*.sql and drizzle/meta/ files alongside your
schema change. See docs/maintenance/database-migrations.md.
EOF
exit 1
