---
name: provision-app
description: Provision the external resources a new app from this template needs — Neon Postgres, Google/Apple OAuth, Stripe billing, Vercel project + env, a custom domain, a support@ Google Workspace group, and GitHub repo/secrets — using the vercel, neonctl, gcloud, gh, stripe, cf, and aws CLIs. Use when setting up a fresh app, wiring a new environment, or filling in .env for auth/billing/deploy.
---

# Provision a new app

Bring a fresh copy of this template from "runs locally" to "deployed with auth +
billing". Work top-down; each step is independent and safe to skip if that
feature isn't needed yet. **Confirm with the user before creating billable or
public resources** (Vercel projects, Neon projects, Stripe products, domains).

Everything the app reads is validated in `src/env.ts` and documented in
`.env.example`. After each step, put the resulting keys in `.env` (local) and in
Vercel (deployed) — see step 5.

## 0. Local baseline (no external accounts)

```bash
pnpm bootstrap  # creates .env, generates BETTER_AUTH_SECRET, local DB, pushes schema
pnpm dev
```
The app runs with just local Postgres + email/password. Add the services below as needed.

## 1. Database — Neon (preview/prod)

Local dev uses native Postgres (`pnpm bootstrap`). For deployed environments use Neon.
```bash
neonctl auth                                  # one-time browser login
neonctl projects create --name <app>          # note the project id
neonctl connection-string --project-id <id> --database-name neondb
# Optional: a separate branch for preview
neonctl branches create --project-id <id> --name preview
```
Put the pooled connection string in Vercel as `DATABASE_URL` (step 5). The db
client auto-selects the Neon driver from the `*.neon.tech` host — no code change.
Migrations apply automatically at Vercel build/deploy time — see
`docs/maintenance/database-migrations.md`.

Optional: set the `NEON_PROJECT_ID` repo variable and `NEON_API_KEY` repo
secret (`gh variable set` / `gh secret set`) to turn on
`.github/workflows/neon-preview.yml` — a per-PR Neon branch that's migrated and
schema-diffed automatically, deleted when the PR closes.

## 2. Google sign-in — gcloud + Cloud Console

The OAuth **consent screen** and **credential creation** are Console UI (gcloud
can't fully create OAuth client IDs). Steps:
1. `gcloud projects create <gcp-project>` (or reuse one) and set it active:
   `gcloud config set project <gcp-project>`. **If you have a Google Cloud
   Organization, create the project under it from the start**
   (`gcloud projects create <gcp-project> --organization=<org-id>`). Moving a
   solo-owned project into an org later hits Google's anti-hijack safeguards
   (`SOLO_MUST_INVITE_OWNERS` on granting a second owner,
   `SOLO_REQUIRE_TOS_ACCEPTOR` on removing the original one) — there is no API
   workaround; ownership must transfer through the Cloud Console's
   invite-and-accept flow (with a step-up/passkey challenge) before the move
   is even possible. Cheaper to avoid than to fix.
2. In Console → APIs & Services → OAuth consent screen: configure (External),
   add scopes `email`, `profile`, `openid`.
3. Credentials → Create OAuth client ID → Web application. Authorized redirect URI:
   `<APP_URL>/api/auth/callback/google` (add both `http://localhost:3000/...`
   and the production URL).
4. Copy the client id/secret → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
   set `NEXT_PUBLIC_GOOGLE_ENABLED="1"`.

## 3. Apple sign-in — Apple Developer (paid, manual)

Requires the **Apple Developer Program ($99/yr)**. No CLI; all in the portal:
1. Create an **App ID**, then a **Services ID** (this becomes `APPLE_CLIENT_ID`,
   e.g. `com.example.app.web`). Enable "Sign in with Apple"; add the return URL
   `<APP_URL>/api/auth/callback/apple`.
2. Create a **Sign in with Apple key** (.p8) and note the Key ID + your Team ID.
3. Generate the **client secret JWT** from the .p8 (ES256, `iss`=Team ID,
   `sub`=Services ID, `aud`=`https://appleid.apple.com`). **It expires in ≤6
   months** — set a reminder to rotate. Put it in `APPLE_CLIENT_SECRET` and set
   `NEXT_PUBLIC_APPLE_ENABLED="1"`.

## 4. Billing — Stripe CLI

```bash
brew install stripe/stripe-cli/stripe      # not preinstalled
stripe login
stripe products create --name "<Plan>"
stripe prices create --product <prod_id> --unit-amount 1000 --currency usd \
  --recurring.interval month               # → price_… for NEXT_PUBLIC_STRIPE_PRICE_ID
```
Keys: `STRIPE_SECRET_KEY` (dashboard → API keys, test mode),
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PRICE_ID`.
Local webhook loop (prints the `whsec_…` for `STRIPE_WEBHOOK_SIGNING_SECRET`):
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed   # smoke test
```
In production, add the webhook endpoint `<APP_URL>/api/webhooks/stripe` in the
Stripe dashboard and use its signing secret.

## 5. Deploy — Vercel + GitHub

```bash
gh repo create <owner>/<app> --private --source . --push   # if not already on GitHub
# Dependabot labels: a generated repo copies .github/dependabot.yml but NOT the
# template's labels, so create the ones the config references or Dependabot errors
# ("labels could not be found") on its first run.
gh label create dependencies -R <owner>/<app> --color 0366d6 --description "Dependency updates" --force
gh label create ci           -R <owner>/<app> --color fbca04 --description "CI / build configuration" --force

# Enforce the merge gate: PR required + green CI, strict (issue #60 item 4). A
# ruleset lives in repo settings, so a generated repo does NOT inherit the
# template's — apply the codified one:
scripts/setup-branch-protection.sh <owner>/<app>

vercel link                                                 # link this dir to a Vercel project
```

**Env vars — set them for BOTH `production` AND `preview`.** Provisioning only
prod is a common first-deploy trap: the first preview / deploy-preview build
then fails at env validation because the required vars are missing for the
preview environment (issue #60 item 3). `vercel env add` takes multiple
environments at once:

```bash
vercel env add DATABASE_URL      production preview   # Neon pooled string (ideally a preview branch, below)
vercel env add BETTER_AUTH_SECRET production preview  # a NEW `openssl rand -base64 32`
# …GOOGLE_*, APPLE_*, STRIPE_*, AWS_REGION, EMAIL_FROM, NEXT_PUBLIC_APP_URL, etc.
vercel deploy --prod
```

Migrations apply automatically during the Vercel build (`db:deploy` →
`scripts/db-migrate.ts`), which sets the managed-Postgres TLS option and prints
the real error if a connection fails. A local `.env` is kept out of the upload
by `.vercelignore` and is never sourced on Vercel, so it can't clobber the
platform's `DATABASE_URL` (issue #60 items 1–2).

For an **isolated preview database** instead of pointing preview at prod, set the
`NEON_PROJECT_ID` variable + `NEON_API_KEY` secret (step 1) — `neon-preview.yml`
then gives each PR its own migrated branch. For non-PR preview deploys, use a
long-lived Neon `preview` branch's connection string as the preview
`DATABASE_URL` above.

Prefer the session's Vercel skills when available: `vercel:env` to sync,
`vercel:deploy` to ship, `vercel:bootstrap` to link + provision Marketplace
integrations (Neon is available as a Vercel Marketplace integration too).

**Keep it non-interactive.** A few CLIs prompt (org/account/scope selection) and
stall an unattended run (issue #60 item 5). Pass the scope explicitly:
`vercel --scope <team> …` (or run `vercel link` once to record it),
`gh` respects `GH_REPO`/`-R <owner>/<repo>`, and `neonctl --output json` avoids
its interactive picker.

### Custom domain — Vercel + Cloudflare

Default: a **subdomain of one shared zone**, so a new app never blocks on buying
a domain ([ADR-0019](../../../docs/adr/0019-subdomain-default-domains.md)). One
script attaches it to the linked project and creates the DNS record:

```bash
APPS_DOMAIN=<your-shared-zone> scripts/add-app-domain.sh <app>   # → <app>.<your-shared-zone>
```

Promote an app to its own marketed apex domain later (adds apex + www, via a
flattened CNAME so there's no anycast IP to rot):

```bash
scripts/add-app-domain.sh --apex <domain>
```

Then set `NEXT_PUBLIC_APP_URL` to the new HTTPS URL in Vercel (both envs) and
register the production OAuth redirect URIs. The script keeps records **DNS only**
(`proxied: false`) so Vercel can issue the cert; turn on Cloudflare's proxy
afterward with SSL/TLS mode Full (strict). Details: `docs/cli-reference.md`.

## 6. Support email — Google Workspace group (optional)

Gives the app a `support@<domain>` inbox instead of exposing a personal
address. Alternates automated `gh workflow run` dispatches with a handful of
required manual Admin Console clicks (domain verification, Gmail activation,
DKIM generation — none of these have a public API). Full checklist, exact
commands, and known gotchas (a real, unresolved Google-side bug in domain
verification, worked around here) are in
[`docs/setup/workspace-support-group.md`](../../../docs/setup/workspace-support-group.md) —
walk the user through that checklist rather than re-deriving the steps.

The DNS records that step needs (domain-verification TXT, MX, DKIM) are still
applied by hand today (issue #60 item 6). The ones with fixed values (MX,
verification TXT) could be created with the same `cf` CLI
`scripts/add-app-domain.sh` uses; DKIM has no API (its key is generated in the
Admin Console), so that click stays manual.

## 7. Outbound email — AWS SES (optional; required for prod email verification)

Verifies the sending domain, aligns DKIM/SPF/DMARC, requests sandbox exit,
scopes an IAM policy to `ses:SendEmail` on that identity only, and wires
bounce/complaint handling. The full CLI checklist (with console fallbacks) is
in [`docs/setup/aws-ses.md`](../../../docs/setup/aws-ses.md) — walk it rather
than re-deriving the commands. App side: set `AWS_REGION` + `EMAIL_FROM` (and
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` on Vercel).

## 8. Support-form anti-spam — Cloudflare Turnstile (optional, free)

The `/support` form already ships a honeypot + DB-backed rate limiting; for a
public launch add the free Turnstile challenge. Keys come from the Cloudflare
dashboard (no API on the free plan) — see
[`docs/setup/turnstile.md`](../../../docs/setup/turnstile.md). Set
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` locally and on
Vercel.

## After provisioning

- Update `.env` locally and mirror to Vercel; never commit `.env`.
- Register real redirect URIs for the production domain.
- Run `/security-review` before shipping and follow `docs/security.md`.
