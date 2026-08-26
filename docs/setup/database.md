# Database

Local development uses native Postgres; preview/production use Neon. The same
code runs against both — `src/db/index.ts` picks the driver from the
`DATABASE_URL` host (`*.neon.tech` → Neon HTTP driver, else `pg`). See
[ADR-0011](../adr/0011-local-postgres-neon-dual-driver.md).

## Local (native Postgres)

```bash
brew install postgresql@17 && brew services start postgresql@17
pnpm db:local          # creates <app>_dev and prints the DATABASE_URL
```
Local URL (Homebrew socket auth, no password):
`postgresql://<you>@localhost:5432/<app>_dev`

## Neon (deployed)

```bash
neonctl auth
neonctl projects create --name <app>
neonctl connection-string --project-id <id> --database-name neondb
```
Set that pooled string with `npx sst secret set DatabaseUrl "<connection-string>"
--stage production` (read by `sst.config.ts`) and as the `DATABASE_URL` repo
secret used by `.github/workflows/deploy.yml`'s migration step. A separate
Neon **branch** per environment keeps data isolated — see
[deployment.md](./deployment.md).

## Schema & migrations

- Edit `src/db/schema.ts`.
- **Dev / prototyping:** `pnpm db:push` (applies directly, no migration file).
- **Production path:** `pnpm db:generate` (writes SQL to `drizzle/`) then
  `pnpm db:migrate`. Never hand-edit files in `drizzle/`.
- Inspect data: `pnpm db:studio`.

The template ships auth tables (`user`, `session`, `account`, `verification`) and
billing tables (`customer`, `subscription`), plus a baseline migration
(`drizzle/0000_init_schema.sql`) capturing them — `pnpm bootstrap` applies it
via `pnpm db:migrate`.

## Migration automation

Schema changes are enforced and deployed automatically — see
[`database-migrations.md`](../maintenance/database-migrations.md) and
[ADR-0016](../adr/0016-database-migration-automation.md):

- `.github/workflows/deploy.yml` applies pending migrations
  (`pnpm db:deploy` with `FORCE_DB_MIGRATIONS=1`) against the `DATABASE_URL`
  repo secret **before** `sst deploy` on every push to `main` — schema first,
  then the code that needs it. `pnpm build` itself does not migrate anything
  (`db:deploy` is a no-op without `FORCE_DB_MIGRATIONS=1`), so plain local
  builds and CI's build never touch a real database. See
  [deployment.md](./deployment.md).
- CI fails a PR that changes `schema.ts` without a matching `drizzle/`
  migration file.
- Setting the `NEON_PROJECT_ID` repo variable (+ `NEON_API_KEY` secret) turns
  on a per-PR Neon preview branch that gets migrated and schema-diffed
  automatically (`.github/workflows/neon-preview.yml`), catching broken
  migrations before merge.
