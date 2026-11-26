# CLAUDE.md

## Project Overview

Next.js (App Router) TypeScript template with Tailwind CSS, Biome, Vitest,
Playwright, and Drizzle ORM. It ships **authentication** (better-auth: Google,
Apple, email/password), **Stripe subscription billing**, a **local-Postgres →
Neon** dev/prod split, and hardened security defaults — so a new app starts with
login, payments, and a database already wired.

It also includes an optional **Expo mobile app** (`mobile/`) on the same backend,
with shared code in `shared/` (`@app/shared`). The web app stays at the repo
root. See [ADR-0026](./docs/adr/0026-web-and-mobile-workspace.md) and
[docs/setup/mobile.md](./docs/setup/mobile.md); remove it with
`pnpm mobile:remove`.

## Decisions & Docs

Rationale for foundational choices lives in Architecture Decision Records under
`docs/adr/`. **Read the relevant ADR before changing foundational tooling**, and
add a superseding ADR when you change a decision. Setup guides are in
`docs/setup/`, the CLI cheat-sheet in `docs/cli-reference.md`, the security
posture in `docs/security.md`, and operational runbooks in `docs/maintenance/`.
`docs/archive/` holds superseded/historical documentation only — never use it
to understand current state or guide new work.

## Infrastructure and AWS ownership

Read [`docs/agent.md`](./docs/agent.md) before adding or changing cloud
resources. This repository owns deployable application infrastructure; the
organization-level source of truth is recorded only in the derived project's
private `PROJECT_CONTEXT.md`. Use repository-and-environment-scoped GitHub OIDC
roles, keep account-specific values and secrets out of public docs, tag managed
resources, and include an IaC plan plus cost and rollback impact in the PR. Do
not provision external or billable resources without explicit authority.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack) · **Language**: TypeScript 7 (strict, native `tsc` — tsconfig conventions in [ADR-0025](./docs/adr/0025-typescript-7.md))
- **Styling**: Tailwind CSS v4 + `@kornorg/design-system` (components, tokens, feels — [ADR-0020](./docs/adr/0020-design-system.md)) · **Lint/format**: Biome (not ESLint/Prettier)
- **Unit**: Vitest · **E2E**: Playwright (local only, [ADR-0008](./docs/adr/0008-e2e-local-only.md))
- **ORM**: Drizzle · **DB**: local Postgres in dev, Neon in prod ([ADR-0011](./docs/adr/0011-local-postgres-neon-dual-driver.md))
- **Auth**: better-auth, self-hosted ([ADR-0012](./docs/adr/0012-auth-better-auth.md))
- **Billing**: Stripe, env-flagged ([ADR-0013](./docs/adr/0013-stripe-billing.md))
- **AI**: Vercel AI SDK, tiered model access — subscription CLIs locally, API keys deployed ([ADR-0022](./docs/adr/0022-ai-model-access-tiers.md))
- **Email**: pluggable (console in dev, AWS SES when `AWS_REGION` is set)
- **Env**: `@t3-oss/env-nextjs` + Zod · **Actions**: next-safe-action · **PM**: pnpm (workspace)
- **Mobile** (optional): Expo SDK 58, expo-router, plain React Native `StyleSheet`, better-auth Expo client ([ADR-0026](./docs/adr/0026-web-and-mobile-workspace.md))

## Project Structure

```
mobile/                   # Expo app (optional; `pnpm mobile:remove` deletes it)
shared/src/               # @app/shared: api.ts (HTTP contract), app.ts (APP_SCHEME),
                          # auth.ts (Zod sign-up/password), password.ts, legal.ts
src/
├── app/
│   ├── (auth)/           # sign-in, sign-up, forgot/reset-password
│   ├── (app)/dashboard/  # protected demo page (requireUser)
│   ├── (legal)/          # terms, privacy, acceptable-use, ai-disclosure, cookies
│   └── api/
│       ├── auth/[...all]/     # better-auth handler
│       ├── me/                # example session-checked JSON route (used by mobile)
│       └── webhooks/stripe/   # signature-verified Stripe webhook
├── components/           # auth-form, sign-out-button, billing-button,
│                         # site-footer, cookie-banner, ai-disclosure-notice
├── content/legal/        # config.ts — company info + LEGAL_VERSION for the (legal) pages
├── db/                   # schema.ts (auth + billing tables) + dual-driver index.ts
├── lib/
│   ├── ai/               # model access: provider.ts (runText/runObject),
│   │                     # model-id.ts, deployment-boundary.ts (ToS guard)
│   ├── auth.ts           # better-auth server instance
│   ├── auth-client.ts    # better-auth React client
│   ├── auth/             # session.ts (getSession/requireUser), api-session.ts
│   │                     # (withApiSession for JSON routes), mobile.ts (Expo seam)
│   ├── email/            # pluggable sendEmail()
│   ├── stripe/           # client, actions, customer, webhook mapping
│   └── safe-action.ts    # actionClient + authActionClient
├── env.ts                # type-safe env
└── proxy.ts              # Next 16 proxy (formerly middleware): auth redirect + CSP
scripts/                  # bootstrap.sh, preflight.sh, rename-app.sh, db-local.sh,
                          # dev-all.sh, remove-mobile.sh, hooks/
```

## Common Commands

```bash
pnpm bootstrap        # bootstrap a fresh clone (env, secret, local DB, schema)
pnpm preflight        # read-only check: required + optional tooling, .env, DB, browsers
pnpm dev              # dev server (Turbopack)
pnpm dev:mobile       # Expo dev server (the app needs the web server for its API)
pnpm dev:all          # web + Expo dev servers
pnpm mobile:check     # mobile type check, tests, `expo install --check`
pnpm mobile:remove    # delete the mobile app (web-only project)
pnpm build            # production build
pnpm check[:fix]      # Biome lint+format
pnpm test             # unit tests (Vitest)
pnpm e2e[:ui]         # E2E (Playwright, local)
pnpm smoke[:build]    # production-render smoke (boots `next start`; :build builds first)
pnpm db:local         # create the local dev database
pnpm db:push          # push schema (dev)
pnpm db:generate      # generate a migration
pnpm db:migrate       # run migrations (prod path)
pnpm db:studio        # Drizzle Studio
pnpm db:deploy        # applies pending migrations; runs automatically as an
                      # explicit pre-deploy step in .github/workflows/deploy.yml
                      # — see docs/maintenance/database-migrations.md
```

## Code Style

- Biome only; tabs; line width 100; double quotes; semicolons. Run `pnpm check:fix` before committing.
- A commit is gated by a PreToolUse hook that runs `pnpm check && pnpm test` in
  the checkout being committed, main or worktree (`.claude/settings.json` →
  `scripts/hooks/pre-commit-gate.sh`; tests in
  `src/__tests__/pre-commit-gate.test.ts`). It runs the copy of the script in the
  session's project directory, and needs `pnpm` on PATH and dependencies installed
  in the checkout being committed.

## Environment Variables

- Defined + validated in `src/env.ts` (Zod). Add new vars to **both** `src/env.ts`
  and `.env.example`. Import `env` from `@/env`; never read `process.env` directly.
- The mobile app reads `EXPO_PUBLIC_API_URL` (the web app's origin) from
  `mobile/.env`, documented in `mobile/.env.example`: optional in development
  (defaults to port 3000 on the Expo host), required in production builds.
  `EXPO_PUBLIC_*` values are bundled into the app, so never put a secret there.
- Only `DATABASE_URL` + `BETTER_AUTH_SECRET` are required; social/email/Stripe
  vars are optional and gate their features. `SKIP_ENV_VALIDATION=1` for CI builds.

## Database

- Schema in `src/db/schema.ts`. `src/db/index.ts` auto-selects the driver from
  `DATABASE_URL` (Neon HTTP for `*.neon.tech`, else `pg`). Same code, both envs.
- `db:push` for prototyping; `db:generate` + `db:migrate` for production. Never
  edit `drizzle/` migrations by hand.
- **Migrations are automated end to end** (see [ADR-0016](./docs/adr/0016-database-migration-automation.md)
  and `docs/maintenance/database-migrations.md`): `.github/workflows/deploy.yml`
  applies pending migrations before `sst deploy` on every push to `main`; CI
  fails a PR that changes `schema.ts` without a matching migration file under
  `drizzle/`; an
  optional per-PR Neon branch + migration workflow is available once
  `NEON_PROJECT_ID` is set. A schema change still needs
  `pnpm db:generate --name <name>` and a commit — the deploy step only applies
  what's already committed.

## Auth

- Server instance: `src/lib/auth.ts`. Read the session with `getSession()` /
  `requireUser()` from `src/lib/auth/session.ts` in **every** protected page and
  server action — the `src/proxy.ts` cookie check is only an optimistic redirect.
- Password rules live in `shared/src/password.ts` (one source of truth), enforced
  on the form, in the shared Zod schema (`shared/src/auth.ts`), and server-side.
  Social providers turn on when their env vars exist.
- Mobile uses email/password through the better-auth Expo client. The server side
  is only `src/lib/auth/mobile.ts` (a local origin-header plugin + trusted
  deep-link origins; keep the export names, `remove-mobile.sh` overwrites the
  file). Don't add `@better-auth/expo` to the root package (ADR-0026). `exp://` is trusted in
  development only — don't widen that.
- Email verification: sent on sign-up, and re-sent automatically on an unverified
  sign-in attempt (`sendOnSignIn`, so a lost first email self-heals). Users can
  also request one explicitly at `/verify-email` (enter email; enumeration-safe)
  or one-click from the dashboard's unverified notice
  (`src/components/resend-verification-button.tsx`). Verification is only
  *required* to sign in in production (`requireEmailVerification`).

## Billing (Stripe)

- Inert until `STRIPE_SECRET_KEY` is set (`isBillingEnabled`). Server actions in
  `src/lib/stripe/actions.ts`; the webhook (`src/app/api/webhooks/stripe/route.ts`)
  is the source of truth for subscription state. **Check entitlement by reading
  the `subscription` table server-side**, never a client value.

## Support form

- Public contact form at `/support` → emails `legalConfig.supportEmail`
  (`src/content/legal/config.ts`) with the sender as reply-to, and stores every
  accepted submission in the `support_request` table (audit trail).
- Anti-spam is layered in `src/lib/support/anti-spam.ts`: honeypot (always on)
  → optional Cloudflare Turnstile (inert until `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  + `TURNSTILE_SECRET_KEY` are set, see `docs/setup/turnstile.md`) → DB-backed
  sliding-window rate limits (per IP hash + per email). Keep all checks
  server-side; the disabled submit button is UX only.
- SES-side provisioning/hardening for outbound mail: `docs/setup/aws-ses.md`.

## AI / Model Access

- Inert until `AI_MODEL` is set. All model calls go through `runText()` /
  `runObject()` in `src/lib/ai/provider.ts` — never call
  `generateText`/`generateObject` from `ai` directly.
- Model ids are `"<tier>/<model>"`: `anthropic/*` + `openai/*` (API keys,
  deployable) vs `claude-code/*` + `codex/*` (personal subscription CLIs,
  **local `next dev` only**). Setup: `docs/setup/ai.md`.
- **Anthropic/OpenAI ToS — do not break this** ([ADR-0022](./docs/adr/0022-ai-model-access-tiers.md)):
  never weaken `assertSubscriptionModelAllowed()` /
  `assertAiDeploymentBoundary()` (`src/lib/ai/deployment-boundary.ts`) or
  their tests; never default a subscription id in deployed config; never
  top-level-import the `ai-sdk-provider-claude-code` / `ai-sdk-provider-codex-cli`
  adapters (they stay lazily loaded + in `serverExternalPackages`); never send a
  subscription OAuth token to the Anthropic/OpenAI APIs.
- User-facing AI features additionally need `<AiDisclosureNotice>` +
  `NEXT_PUBLIC_AI_FEATURES_ENABLED` (see Legal below).

## Server Actions

- `next-safe-action`: `actionClient` for public, `authActionClient` (adds
  `ctx.user`) for authenticated. Define with `.schema(zod).action(async ({ parsedInput, ctx }) => …)`.

## API routes and Mobile

- The mobile app calls HTTP routes, **never server actions**. New feature order:
  validation + response schema in `@app/shared` → server logic → route under
  `src/app/api/` with a session check → web page + mobile screen
  (`docs/setup/mobile.md`).
- Wrap session-gated reads in `withApiSession()` (`src/lib/auth/api-session.ts`);
  `src/app/api/me/route.ts` is the example, `ME_PATH` / `meResponseSchema` in
  `shared/src/api.ts` its contract. `src/proxy.ts` does not run on `/api`, and a
  state-changing route must also verify the request origin itself.
- Installed apps lag the backend: keep API responses backward compatible.
- Deferred (not built): native Google/Apple sign-in, mobile payments, store
  release/EAS, in-app account deletion, matching design system.

## Security

- See `docs/security.md`. Drizzle parameterizes queries — never build SQL by
  string concatenation. Baseline headers in `next.config.ts`; nonce CSP in
  `src/proxy.ts`. Run `/security-review` before shipping.

## Legal

- `src/app/(legal)/` (ToS, Privacy, Acceptable Use, AI Disclosure, Cookies).
  Fill in `src/content/legal/config.ts` first; that's the
  single source for company name/address/governing law. `LEGAL_VERSION` is
  defined in `shared/src/legal.ts` (config.ts re-exports it).
- Sign-up requires accepting current-version ToS/Privacy, enforced server-side
  in `src/lib/auth.ts`'s `before` hook — don't relax that to client-only.
- Building an AI-facing feature? Drop `<AiDisclosureNotice>`
  (`src/components/ai-disclosure-notice.tsx`) into its UI and flip
  `NEXT_PUBLIC_AI_FEATURES_ENABLED`. Consequential-decision uses (employment,
  credit, housing, insurance, healthcare, education) need more than the default
  disclosure — see `docs/legal.md`.

## Provisioning & CLIs

Agents can use these CLIs (see `docs/cli-reference.md`): **sst** (AWS deploy),
**neonctl** (Postgres), **gcloud** (Google OAuth project), **gh** (repo/secrets),
**stripe** (billing), **cf** (Cloudflare DNS records SST doesn't manage
itself). The **`provision-app`** skill orchestrates setting up a new
app's resources end-to-end; **`rename-app`** rebrands a fresh copy. Confirm before
creating billable/public resources.

## Testing

- Unit: `*.test.ts(x)` alongside source or in `src/__tests__/`; `@/*` → `src/*`.
  `pnpm test` covers `src/` and `shared/src/`; the mobile app has its own Vitest
  run and type check (`pnpm mobile:check`). The commit hook runs only
  `pnpm check && pnpm test`, so run `pnpm mobile:check` after touching `mobile/`
  or `shared/`.
- E2E: `e2e/*.spec.ts`; Playwright auto-starts the dev server (Chromium only).
  Needs a local DB running for auth flows. Run locally with `pnpm e2e`; if
  port 3000 is taken by another project, use
  `E2E_PORT=3100 NEXT_PUBLIC_APP_URL=http://localhost:3100 pnpm e2e`. Covers:
  sign-up→dashboard→sign-out + protected-route redirect (`auth.spec`), the home
  page (`home.spec`), password-reset pages (`password-reset.spec`), the
  verification-resend page + dashboard resend button (`verify-email.spec`), and
  the support form (`support.spec`). Shared sign-up helper in `e2e/helpers.ts`.
- **E2E is local-only.** GitHub Actions never runs Playwright, including for
  Dependabot and manual dispatches. Run `pnpm e2e` before merging changes to a
  covered flow or releasing; see [ADR-0024](./docs/adr/0024-e2e-local-only.md).
- Render smoke: `scripts/render-smoke.mts` boots a **production** build
  (`next start`) and asserts key routes server-render real content under the real
  strict CSP — catching prod-only blank-screen bugs that dev (permissive CSP) and
  the dev-server E2E miss. Runs on **every** PR (`.github/workflows/render-smoke.yml`),
  needs no DB. Run locally with `pnpm smoke:build`. Add a route/marker when you add
  a route with client-render or CSP risk. See [ADR-0021](./docs/adr/0021-production-render-smoke.md).
- CI gates every PR on Biome, type-check, Vitest, build, a schema/migration
  check, and a **lockfile-integrity guard**. These come from reusable workflows
  in `kornsour/gh-automation` ([ADR-0018](./docs/adr/0018-reusable-ci-workflows.md)),
  called from `.github/workflows/{ci,lockfile,dependabot-auto-merge}.yml`.
  Dependabot patch/minor PRs auto-merge once these pass —
  see [docs/maintenance/dependabot.md](./docs/maintenance/dependabot.md).
- A local job in `ci.yml`, **`Mobile (type check, tests)`**, is also required:
  `pnpm mobile:check` (Expo check offline) plus an Android + iOS Metro export.
  Don't path-filter it. Dependabot doesn't bump Expo SDK packages; upgrade with
  `expo install --fix` (`docs/setup/mobile.md`).
