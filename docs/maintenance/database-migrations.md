# Database migrations

Operational guide for schema changes. For the driver/hosting decision, see
[ADR-0011](../adr/0011-local-postgres-neon-dual-driver.md); for why the
pipeline below exists, see
[ADR-0016](../adr/0016-database-migration-automation.md).

## The golden rule

**Every change to `src/db/schema.ts` needs a matching migration file under
`drizzle/`.** CI enforces this (`db-migration-check` in `ci.yml`) — a PR that
edits the schema without a migration fails the build.

## Quick reference

```bash
# 1. Edit the schema
code src/db/schema.ts

# 2. Generate a migration (does NOT touch any database — it's a static diff
#    against drizzle/meta/*.json, so it works with no DB running)
pnpm db:generate --name add_user_bio

# 3. Apply it to your local dev database
pnpm db:migrate

# 4. Commit schema.ts AND the new drizzle/*.sql + drizzle/meta/ files together
git add src/db/schema.ts drizzle/
git commit -m "Add user.bio"

# 5. Push — the PR's Neon preview branch (if configured) gets migrated and
#    schema-diffed automatically; merging to main deploys to Vercel, whose
#    build applies the same migration to the real database before `next build`.
git push
```

## How deploy-time automation works

- `pnpm build` runs `pnpm db:deploy` (`scripts/db-deploy.sh`) before `next build`.
- That script only actually runs `drizzle-kit migrate` when `VERCEL` is set —
  i.e. on a real Vercel build (preview or production), where `DATABASE_URL` is
  a real, reachable database and env vars are already in the process
  environment. Plain local `pnpm build` and CI's build job (fake placeholder
  `DATABASE_URL`) skip it by default.
- To test the full deploy path locally against your dev database:
  `FORCE_DB_MIGRATIONS=1 pnpm build`.
- To skip migrations on a Vercel build (e.g. you already applied them by
  hand): set `SKIP_DB_MIGRATIONS=1` as a Vercel env var for that deployment.

## Common scenarios

### Adding a column or table

```bash
code src/db/schema.ts
pnpm db:generate --name add_recipe_notes
pnpm db:migrate
git add src/db/schema.ts drizzle/
git commit -m "Add notes to recipe"
```

### Renaming a column (needs care)

Drizzle's generator can't distinguish "rename" from "drop old column, add new
column," which loses data. Write a hand-authored migration instead of letting
`generate` diff it:

```bash
pnpm exec drizzle-kit generate --custom --name rename_title_to_name
# writes an empty drizzle/000X_rename_title_to_name.sql — fill it in:
#   ALTER TABLE "recipe" RENAME COLUMN "title" TO "name";
pnpm db:migrate
```

Only hand-edit a migration file before it has been applied anywhere and
committed — see "What not to do" below.

### Prototyping before the shape is final

`pnpm db:push` applies `schema.ts` straight to your local database with no
migration file — good for iterating on a shape you haven't committed to yet.
Once it's settled, run `pnpm db:generate` to capture it as a real migration.
Never use `db:push` against a preview or production database.

## What NOT to do

- **Never edit a migration file once it's been committed and applied
  anywhere.** Drizzle's journal tracks migrations by content; editing an
  applied one causes drift between environments. If a migration was wrong,
  write a new migration that corrects it.
- **Never run `pnpm db:push` against Neon (preview/prod).** It bypasses the
  migration history that `db:deploy` and CI rely on.
- **Never delete a file under `drizzle/`.** It breaks migration history for
  every environment ahead of that point.
- **Don't silence the CI migration check by adding an unrelated file under
  `drizzle/`.** If the schema really didn't need a migration (e.g. you edited
  a comment or a TypeScript-only helper type), that's fine — the check only
  fires when `schema.ts` itself changed.

## Troubleshooting

**"relation already exists" during `db:migrate`.** Something applied the
schema outside of migrations (usually a stray `db:push` against that
database). Reconcile manually, or drop and recreate a local dev database — it
holds no real data.

**CI's `db-migration-check` fails.** You changed `src/db/schema.ts` without a
migration. Run `pnpm db:generate --name <name>`, commit the result.

**A Vercel build fails on `db:deploy`.** The build log shows the
`drizzle-kit migrate` error directly — treat it like any other broken
migration: fix forward with a new migration, don't hand-edit the failed one in
place. `SKIP_DB_MIGRATIONS=1` unblocks a deploy in an emergency but leaves the
database schema stale until you migrate it another way.
