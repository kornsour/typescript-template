# Deployment (Vercel + Neon)

## First deploy

```bash
gh repo create <owner>/<app> --private --source . --push   # if not on GitHub yet
scripts/setup-branch-protection.sh <owner>/<app>           # PR + green-CI merge gate
vercel link                                                 # link dir → Vercel project
```

A repo generated from the template does **not** inherit the template's branch
ruleset (rulesets are repo settings, not files), so run
`setup-branch-protection.sh` once to apply the codified one
(`.github/rulesets/default-branch.json`): a PR is required and can't merge until
CI is green and the branch is up to date.

## Environment variables

Set every server + `NEXT_PUBLIC_*` var from `.env.example` in Vercel **for both
`production` and `preview`**. Setting only production is a common trap: the
first preview / deploy-preview build then fails at env validation because the
required vars are missing for preview. Minimum to boot: `DATABASE_URL` (Neon) and
a **fresh** `BETTER_AUTH_SECRET` (never reuse the local one).

```bash
vercel env add BETTER_AUTH_SECRET production preview  # openssl rand -base64 32
# …GOOGLE_*, APPLE_*, STRIPE_*, AWS_REGION, EMAIL_FROM, NEXT_PUBLIC_APP_URL
vercel env pull .env.local                            # sync down for local parity
```

### `DATABASE_URL` needs a different value per environment

Give Preview its **own** database — a long-lived Neon `preview` branch — and add
the two environments separately:

```bash
vercel env add DATABASE_URL production   # prod branch connection string
vercel env add DATABASE_URL preview      # preview branch connection string
```

Do not add one shared value for both. Every Vercel build runs `pnpm db:deploy`
(see [database-migrations.md](../maintenance/database-migrations.md)), so if
Preview resolves to the production database, **each preview deployment applies
its branch's migrations to production** — before the PR is reviewed or merged,
destructive ones included. Preview deployments would also read and write live
production data.

If Preview must share the production `DATABASE_URL` for now, guard it
explicitly:

```bash
vercel env add SKIP_DB_MIGRATIONS preview   # value: 1
```

That stops preview builds from mutating the production schema. It does **not**
stop them reading and writing production data — a separate database is the only
fix for that.

Setting `NEON_PROJECT_ID`/`NEON_API_KEY` is worth doing as well, but it is not a
substitute for either of the above: it gives each PR a migrated Neon branch in
**CI**, which is where a broken migration gets caught. It has no effect on what a
Vercel preview deployment connects to (see [database.md](./database.md)).

Or use the session's Vercel skills: `vercel:env` (sync/diff), `vercel:deploy`
(ship), `vercel:bootstrap` (link + Marketplace integrations, incl. Neon).

> A local `.env` is never uploaded (`.vercelignore`) and never sourced on Vercel,
> so it can't override the `DATABASE_URL` Vercel injects — the build reads only
> the platform's env vars.

## Deploy

```bash
vercel deploy            # preview
vercel deploy --prod     # production
```

## Custom domain (Vercel + Cloudflare DNS)

New apps default to a **subdomain of one shared zone** so the first deploy never
blocks on buying a domain ([ADR-0019](../adr/0019-subdomain-default-domains.md)).
`scripts/add-app-domain.sh` attaches the domain to the linked project and creates
the DNS record in one step:

```bash
APPS_DOMAIN=<your-shared-zone> scripts/add-app-domain.sh <app>   # → <app>.<your-shared-zone>
scripts/add-app-domain.sh --apex <domain>                        # promote: apex + www
```

The apex path uses a CNAME at the apex (Cloudflare flattens it), so no anycast IP
is hard-coded. Records are created **DNS only** (`proxied: false`) so Vercel can
issue the cert — a proxied (orange-cloud) record in front of Vercel's own
edge/TLS can block certificate issuance. Enable Cloudflare's proxy afterward only
with SSL/TLS mode Full (strict). To do it by hand instead, see
[cli-reference.md](../cli-reference.md#cf--cloudflare-dns-for-a-custom-domain).

After the domain is live, set `NEXT_PUBLIC_APP_URL` to the new HTTPS URL (both
environments) and register the production OAuth redirect URIs.

## Post-deploy checklist

1. `NEXT_PUBLIC_APP_URL` = the real HTTPS domain (OAuth redirects + email links).
2. Register production OAuth redirect URIs (`<APP_URL>/api/auth/callback/<provider>`).
3. Add the Stripe **live** webhook endpoint + signing secret.
4. Confirm `AWS_REGION` + `EMAIL_FROM` are set and `EMAIL_FROM` is a verified SES
   identity/domain in that region (email verification is required in prod).
   Vercel has no IAM role to fall back on, so the AWS SDK's default credential
   chain needs `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` set as env vars too
   (app code has no provider-specific logic either way).
5. Schema migrations apply automatically — `pnpm build` runs `pnpm db:deploy`
   before `next build` on every Vercel deploy (gated on the `VERCEL` env var,
   so this doesn't need a manual step). See
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
