# ADR-0021: Production-render smoke test in CI

- Status: Accepted
- Date: 2026-07-12

## Context

A `"use client"` reset-password page that read its token with `useSearchParams()`
prerendered to an empty client-only shell and then never painted under the
production strict-nonce CSP (`src/proxy.ts`) — a blank screen for users. Nothing
caught it:

- `pnpm dev` serves a **permissive** CSP, so the page renders fine locally.
- The Playwright E2E suite boots the **dev server** (`webServer: pnpm dev` in
  `playwright.config.ts`) and is Dependabot-gated in CI ([ADR-0017](./0017-e2e-in-ci-for-dependabot.md)),
  so it never exercised the production CSP or the static/dynamic route split.
- Vitest/type-check/build don't render pages over HTTP.

The failure only reproduces against a real production build (`next build &&
next start`). That is cheap to run and needs no database — the risky routes
(auth forms, legal pages, home) render without one.

## Decision

Add a **production-render smoke test** that boots `next start` and asserts each
important route SERVER-renders its real content instead of a blank shell.

- `scripts/render-smoke.mts`: for a fixed route list, fetches the raw (no-JS)
  server HTML and asserts route-specific functional markers are present (e.g.
  `/reset-password?token=…` must contain two `type="password"` inputs — the
  direct regression guard). It also asserts every HTML response carries the
  **strict** production CSP (`'strict-dynamic'`, no `'unsafe-inline'` in
  `script-src`), so the smoke fails loudly if ever pointed at a dev server rather
  than passing green against the wrong target.
- `pnpm smoke` runs the checks (spawning `next start` itself, or against
  `SMOKE_BASE_URL` if set — e.g. a deployed preview); `pnpm smoke:build` builds
  first.
- `.github/workflows/render-smoke.yml` runs it on **every** PR (and push to
  `main`) with placeholder env and no database. Unlike E2E, it's fast and
  deterministic, so it isn't Dependabot-gated.

Deliberately kept as an HTTP/no-browser check: it catches the blank-shell class
without Playwright's browser download, and complements — does not replace — the
E2E suite. A local production build is sufficient; a live Vercel deployment is
**not** required to catch this class of bug (it would add cost and flake without
adding signal the local prod build lacks). Integration concerns that only a real
deploy exercises (Neon, OAuth callbacks, SES, Stripe webhooks) remain out of
scope here.

## Consequences

- Production-only render regressions (client/params/CSP interactions, accidental
  static prerendering of a route that must be dynamic) are caught per-PR, before
  merge, without a human manually running `next build`.
- The marker list in `scripts/render-smoke.mts` must be kept in sync when routes
  or their key copy change; a marker going stale surfaces as a smoke failure to
  update, not a silent gap.
- CI does one extra production build per PR (~tens of seconds). The `ci` build
  job already builds, so this is duplicated work accepted for an isolated,
  server-boot-capable artifact.
- Not yet wired as a **required** status check — enabling that in branch
  protection is a repo-owner action once the job has a track record.
