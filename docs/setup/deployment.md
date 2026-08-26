# Deployment (AWS via SST v4 + OpenNext)

Apps built from this template deploy to AWS — Lambda behind CloudFront
(`sst.aws.Nextjs`), static assets on S3, ISR cache in DynamoDB. See
[ADR-0023](../adr/0023-aws-sst-deploy.md) for why, `sst.config.ts` for the
config, and `.github/workflows/deploy.yml` for the deploy step itself.

## First deploy

```bash
gh repo create <owner>/<app> --private --source . --push   # if not on GitHub yet
scripts/setup-branch-protection.sh <owner>/<app>           # PR + green-CI merge gate
```

A repo generated from the template does **not** inherit the template's branch
ruleset (rulesets are repo settings, not files), so run
`setup-branch-protection.sh` once to apply the codified one
(`.github/rulesets/default-branch.json`): a PR is required and can't merge until
CI is green and the branch is up to date.

### Wire up the deploy workflow

`.github/workflows/deploy.yml` no-ops until these exist:

- **`AWS_DEPLOY_ROLE_ARN`** repo variable — an IAM role that trusts GitHub's
  OIDC provider (Settings → Secrets and variables → Actions → Variables). No
  static AWS keys are ever stored in the repo.
- **`DATABASE_URL`** repo secret — used only by the pre-deploy migration step.
- **`CLOUDFLARE_API_TOKEN`** repo secret, scoped to `Zone:DNS:Edit`, and
  **`CLOUDFLARE_ZONE_ID`** repo secret — so `sst deploy` can create the
  Cloudflare DNS record for the app's hostname.

### App secrets (`sst.Secret`)

`sst.config.ts` reads `DatabaseUrl` and `BetterAuthSecret` from SST's encrypted
parameter store, set once per stage:

```bash
npx sst secret set DatabaseUrl "<Neon connection string>" --stage production
npx sst secret set BetterAuthSecret "$(openssl rand -base64 32)" --stage production
```

Never reuse the local `BETTER_AUTH_SECRET` — generate a fresh one per stage.

### `DATABASE_URL` needs a different value per environment

Give any non-production stage its **own** database — a long-lived Neon branch —
rather than pointing it at the production connection string. The deploy
workflow migrates whatever `DATABASE_URL` resolves to for that run (see
[database-migrations.md](../maintenance/database-migrations.md)); sharing one
value between stages means a non-production deploy could migrate — or read and
write — production data.

Setting `NEON_PROJECT_ID`/`NEON_API_KEY` (`.github/workflows/neon-preview.yml`)
is worth doing as well: it gives each PR a migrated Neon branch in **CI**,
which is where a broken migration gets caught before merge. It's a separate
mechanism from the deploy workflow's own migration step — see
[database.md](./database.md).

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: migrations first
(`pnpm db:deploy` with `FORCE_DB_MIGRATIONS=1`), then `pnpm sst deploy --stage
production`. To deploy by hand (e.g. from a local machine with AWS
credentials already configured):

```bash
pnpm sst:check                        # validates sst.config.ts (runs `sst install`)
FORCE_DB_MIGRATIONS=1 pnpm db:deploy   # apply pending migrations first
pnpm sst deploy --stage production
```

## Custom domain (SST + Cloudflare DNS)

New apps default to a **subdomain of one shared zone** so the first deploy never
blocks on buying a domain ([ADR-0019](../adr/0019-subdomain-default-domains.md)).
`domainConfig()` in `sst.config.ts` decides the hostname, and `sst deploy`
provisions the us-east-1 ACM certificate and the Cloudflare DNS record itself —
no separate script or manual DNS step:

- Default: `<app>.$APPS_DOMAIN` (falls back to the fleet's shared zone,
  `uresu.app`, if `APPS_DOMAIN` is unset).
- Promotion to a dedicated apex: set the `APP_DOMAIN` env var before deploying.
  `www.<domain>` redirects to the apex.

Non-production stages skip all of this and get SST's generated CloudFront URL,
so they never need a certificate or a DNS record.

After the domain is live, set `NEXT_PUBLIC_APP_URL` to the new HTTPS URL and
register the production OAuth redirect URIs.

## Post-deploy checklist

1. `NEXT_PUBLIC_APP_URL` = the real HTTPS domain (OAuth redirects + email links)
   — set via `environment` in `sst.config.ts` (`appUrl()`).
2. Register production OAuth redirect URIs (`<APP_URL>/api/auth/callback/<provider>`).
3. Add the Stripe **live** webhook endpoint + signing secret.
4. Confirm `AWS_REGION` + `EMAIL_FROM` are set and `EMAIL_FROM` is a verified SES
   identity/domain in that region (email verification is required in prod).
   The app's Lambda execution role is the runtime credential — no static AWS
   key belongs in source, `.env.example`, or GitHub Actions. Full SES
   provisioning + hardening checklist (DKIM/SPF/DMARC, sandbox exit,
   least-privilege IAM, bounce handling): [`aws-ses.md`](./aws-ses.md).
5. Schema migrations apply automatically as an explicit pre-deploy step — see
   [`../maintenance/database-migrations.md`](../maintenance/database-migrations.md).
6. Work through [`../security.md`](../security.md) and run `/security-review`.

## CI

`.github/workflows/ci.yml` runs Biome, `tsc`, Vitest, and `pnpm build` on every
push/PR with `SKIP_ENV_VALIDATION=1` (no DB in CI); `db-migration-check` fails a
PR that changes `src/db/schema.ts` without a matching migration file. E2E runs
locally only ([ADR-0008](../adr/0008-e2e-local-only.md)).

`.github/workflows/neon-preview.yml` gives each PR its own migrated Neon branch
once `NEON_PROJECT_ID` is set — see
[`../maintenance/database-migrations.md`](../maintenance/database-migrations.md).

`.github/workflows/render-smoke.yml` builds the production bundle and smoke-tests
it on every PR — see [ADR-0021](../adr/0021-production-render-smoke.md).
