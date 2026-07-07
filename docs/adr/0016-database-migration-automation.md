# ADR-0016: Automated migration deploy, CI validation, and optional Neon preview branches

- Status: Accepted
- Date: 2026-07-06

## Context

[ADR-0005](./0005-data-layer-drizzle-neon.md) chose Drizzle's generate/migrate
split for production schema changes, and [ADR-0011](./0011-local-postgres-neon-dual-driver.md)
gave every app a local Postgres for dev. Neither closed the operational gap
between "a migration file exists in `drizzle/`" and "that migration actually
ran against the deployed database": applying it to preview/production was a
manual step someone had to remember, with nothing catching a schema change
that shipped without a migration at all. Other apps built by this account (see
deCuisine's `db:deploy`/`prebuild` script and its migration-validation CI
check) hit exactly this gap and closed it with build-time auto-apply plus a CI
guard; this ADR brings the same shape into the template so every app built
from it starts with it already wired up, adapted for Drizzle instead of
Prisma.

Until this change, no migration had ever been generated for this template —
`bootstrap.sh` used `db:push` to sync the local dev database directly, with no
migration history at all.

## Decision

- Generate a baseline migration (`drizzle/0000_init_schema.sql`) capturing the
  auth + billing tables that already exist in `schema.ts`, so every app forked
  from the template starts with real migration history instead of `db:push`
  drift. `bootstrap.sh` and `db-local.sh` now point at `pnpm db:migrate` for
  initial schema setup; `db:push` remains for pre-migration prototyping only
  (per ADR-0005).
- `pnpm build` runs `pnpm db:deploy` (`scripts/db-deploy.sh`) before `next
  build`. That script applies pending migrations via `drizzle-kit migrate`,
  but only when the `VERCEL` env var is set — i.e. on a real Vercel build,
  where `DATABASE_URL` is real and reachable and env vars already live in the
  process environment. Plain local `pnpm build` and CI's build job (which uses
  a fake placeholder `DATABASE_URL`) skip it automatically, so neither
  requires a live database. Escape hatches: `SKIP_DB_MIGRATIONS=1` force-skips
  even on Vercel; `FORCE_DB_MIGRATIONS=1` force-runs locally to test the full
  path before pushing.
- A CI job (`db-migration-check` in `ci.yml`, backed by
  `scripts/check-migration-added.sh`) fails a PR that changes
  `src/db/schema.ts` without adding a file under `drizzle/`. This is the same
  failure mode deCuisine's "Migration Validation" check catches, adapted to
  diff against the PR base ref instead of Prisma's schema/migration coupling.
- An optional GitHub Action (`.github/workflows/neon-preview.yml`) gives each
  PR its own Neon branch, migrates it, and posts a schema diff comment —
  mirrors deCuisine's `neon-workflow.yml`, with `drizzle-kit migrate` in place
  of `prisma migrate deploy`. It's gated on the `NEON_PROJECT_ID` repo
  variable being set, so it's a true no-op for apps that haven't provisioned
  Neon yet (most apps, at first) rather than a broken required check.
- `docs/maintenance/database-migrations.md` documents the day-to-day workflow,
  common scenarios (add column, rename, prototyping), what not to do (never
  hand-edit an applied migration, never `db:push` against Neon, never delete a
  migration file), and troubleshooting — the same shape as deCuisine's
  `migration-workflow.md`.

## Consequences

- A merged schema change reaches the deployed database automatically on the
  next Vercel build; there's no separate "remember to run `db:migrate` against
  prod" step to forget.
- The CI check only understands "did `drizzle/` change," not whether the
  migration is semantically correct or safe (e.g. a lossy rename) — it's a
  drift guard, not a review substitute. Renames/data-preserving changes still
  need the hand-authored `--custom` migration path documented in
  `database-migrations.md`.
- The Neon preview workflow adds `neondatabase/create-branch-action`,
  `delete-branch-action`, and `schema-diff-action` as available CI actions;
  they cost nothing when `NEON_PROJECT_ID` is unset, but an app that does set
  it takes on Neon API rate limits and branch-expiry housekeeping (14-day
  auto-expiry is set in the workflow as a backstop against orphaned branches
  from PRs closed without the `closed` event firing cleanup, e.g. a deleted
  branch upstream).
- `db:push` is still available and still the right tool before a schema
  shape is committed to — this ADR doesn't remove it, only moves the default
  bootstrap/local path onto migrations so local dev matches the path
  production actually takes.
