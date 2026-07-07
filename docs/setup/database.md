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
Set that pooled string as `DATABASE_URL` in Vercel (per environment). A separate
Neon **branch** per environment (e.g. `preview`) keeps data isolated.

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

- `pnpm build` applies pending migrations before `next build` on every Vercel
  deploy (`pnpm db:deploy`, gated on the `VERCEL` env var).
- CI fails a PR that changes `schema.ts` without a matching `drizzle/`
  migration file.
- Setting the `NEON_PROJECT_ID` repo variable (+ `NEON_API_KEY` secret) turns
  on a per-PR Neon preview branch that gets migrated and schema-diffed
  automatically (`.github/workflows/neon-preview.yml`).
