# ADR-0023: Deploy to AWS with SST v4 + OpenNext instead of Vercel

- Status: Accepted
- Date: 2026-08-09

## Context

This template's deployment story was Vercel throughout:
[ADR-0016](./0016-database-migration-automation.md) wires migrations into a
Vercel build, [ADR-0019](./0019-subdomain-default-domains.md) attaches domains
via Vercel's API, and the AI deployment boundary in
[ADR-0022](./0022-ai-model-access-tiers.md) keys entirely on `VERCEL_ENV`.

The estate built from this template is moving to AWS (see `AWS-MIGRATION.md` in
the shared `.github` repo). At this traffic level the numbers are stark:
Lambda's 1M requests and CloudFront's 1TB of egress are permanently free, so the
whole hosting bill lands around $1–3/mo against $20/mo for Vercel Pro. The
tooling is further along than most write-ups suggest — `sst` is at 4.17.

Three details drive real decisions here:

1. **The Neon connection limit.** A `pg` TCP pool inside Lambda opens a
   connection per concurrent invocation and holds it past the response,
   exhausting Neon long before the app sees real load. The HTTP driver has no
   connection to leak.
2. **CloudWatch Logs default to never expiring.** Across an estate of apps with
   several Lambdas each, that is the line item that actually appears on the bill.
3. **Route 53 costs $0.50/zone/month**, and Cloudflare DNS is free and already
   hosts the zones.

## Decision

Deploy with **SST v4 + OpenNext** (`sst.aws.Nextjs`): Lambda behind CloudFront,
static assets on S3, ISR cache in DynamoDB. Configuration lives in
`sst.config.ts`.

- **Neon HTTP driver only in Lambda.** `src/db/driver.ts` holds the rules as
  pure, unit-tested functions, and `src/db/index.ts` throws at import time if a
  non-Neon `DATABASE_URL` is seen inside a Lambda (detected via
  `AWS_LAMBDA_FUNCTION_NAME`). Local development keeps the TCP driver, so
  `pnpm dev`, `pnpm build`, the render smoke and the E2E specs are unaffected.
- **`DEPLOY_ENV` replaces `VERCEL_ENV`.** Leaving the AI deployment boundary
  keyed on a variable AWS never sets would have silently disarmed the ToS guard
  in ADR-0022 — the failure mode being a personal Claude subscription quietly
  serving production traffic. `resolveDeployedEnv()` now reads `VERCEL_ENV`,
  `DEPLOY_ENV` (set by `sst.config.ts`) **and** the Lambda runtime marker; an
  unlabelled Lambda is treated as production, the strictest case.
- **Migrations become an explicit deploy step.** ADR-0016's build-time hook is
  gated on the `VERCEL` env var, and `sst deploy` runs `next build` where that
  is unset — so it correctly skips rather than migrating twice.
  `.github/workflows/deploy.yml` instead runs `pnpm db:deploy` with
  `FORCE_DB_MIGRATIONS=1` *before* `sst deploy`.
- **A deploy workflow exists at all.** Vercel's git integration was the deploy
  trigger; nothing in this repo ever invoked it. Without
  `.github/workflows/deploy.yml`, pushes to `main` would simply never ship.
- **14-day CloudWatch retention** on every log group, set in the SST config's
  `transform`, not as an afterthought.
- **Cloudflare for DNS** via `sst.cloudflare.dns()`, needing a token scoped to
  `Zone:DNS:Edit`.
- **No Vercel-only APIs anywhere in the app.**

`sst.config.ts` is excluded from `tsconfig.json`: its `/// <reference>` pulls in
SST's generated platform *sources*, which do not compile under this repo's
TypeScript 6 + `strict` + `noUncheckedIndexedAccess` settings. Relaxing the
app's settings to accommodate a dependency's type errors is the wrong trade, so
the config is validated with `pnpm sst:check` (which runs `sst install`, and
evaluates the config) and still linted and formatted by Biome.

SST also rejects top-level imports in `sst.config.ts`, so the app name cannot be
read from `package.json` there. It is duplicated as an `APP_NAME` constant, and
`scripts/rename-app.sh` rewrites both together.

## Consequences

- **Cold starts are a genuine regression.** At near-zero traffic every visitor
  pays 1–3s for a Lambda cold start. Provisioned concurrency (~$5/mo/app) would
  erase the entire saving, and Node has no SnapStart, so the mitigation is
  aggressive CloudFront caching of static and ISR responses — not warming.
- The ACM certificate must live in **us-east-1** — CloudFront reads certs from
  nowhere else. `sst.aws.Nextjs` handles this when `domain.dns` is set.
- Cost control is on us: AWS has no spend cap. A Budgets alert and a cost
  anomaly detector are the only guardrails, and are set up outside this repo.
- ADR-0019's *policy* (subdomain by default, promote to apex on demand) survives
  intact; only its Vercel mechanics are replaced. See that ADR's amendment.
- **No AWS resources are created by this ADR or by adding `sst.config.ts`.**
  Nothing is provisioned until someone runs `sst deploy`.
