# Deployment (Vercel + Neon)

## First deploy

```bash
gh repo create <owner>/<app> --private --source . --push   # if not on GitHub yet
vercel link                                                 # link dir → Vercel project
```

## Environment variables

Set every server + `NEXT_PUBLIC_*` var from `.env.example` in Vercel, per
environment (Production / Preview). Minimum to boot: `DATABASE_URL` (Neon) and a
**fresh** `BETTER_AUTH_SECRET` (never reuse the local one).

```bash
vercel env add DATABASE_URL production
vercel env add BETTER_AUTH_SECRET production      # openssl rand -base64 32
# …GOOGLE_*, APPLE_*, STRIPE_*, AWS_REGION, EMAIL_FROM, NEXT_PUBLIC_APP_URL
vercel env pull .env.local                        # sync down for local parity
```
Or use the session's Vercel skills: `vercel:env` (sync/diff), `vercel:deploy`
(ship), `vercel:bootstrap` (link + Marketplace integrations, incl. Neon).

## Deploy

```bash
vercel deploy            # preview
vercel deploy --prod     # production
```

## Custom domain (Vercel + Cloudflare DNS)

```bash
vercel domains add <domain> <project>   # adds it to the project, prints the
                                         # required DNS record + target
cf dns records create -z <domain> --body '{"type":"CNAME","name":"app","content":"cname.vercel-dns.com","ttl":1,"proxied":false}'
# apex domain instead of a subdomain? use an A record to Vercel's anycast IP:
#   --body '{"type":"A","name":"@","content":"76.76.21.21","ttl":1,"proxied":false}'
vercel domains inspect <domain>         # poll until it shows a valid configuration
```

Use the target/record type `vercel domains add` actually prints (Vercel has
changed the anycast IP before). Keep the Cloudflare record **DNS only**
(`proxied: false`) until Vercel confirms the cert — a proxied (orange-cloud)
record in front of Vercel's own edge/TLS can block certificate issuance. If you
want Cloudflare's proxy afterward, set its SSL/TLS mode to Full (strict) first.
See [cli-reference.md](../cli-reference.md#cf--cloudflare-dns-for-a-custom-domain).

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
