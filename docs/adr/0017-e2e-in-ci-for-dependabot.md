# ADR-0017: Run E2E in CI for Dependabot PRs (auto-merge safety net)

- Status: Accepted
- Date: 2026-07-07
- Supersedes: [ADR-0008](./0008-e2e-local-only.md)

## Context

[ADR-0008](./0008-e2e-local-only.md) kept Playwright out of CI because the repo
was minutes-constrained and the E2E suite was minimal. Two things changed:

1. The repository is **public**, so GitHub Actions on standard runners is free
   and unmetered — the minutes constraint that motivated ADR-0008 no longer
   exists.
2. We want to **auto-merge Dependabot patch/minor PRs** (see
   `docs/maintenance/dependabot.md`). Auto-merge removes the human who currently
   catches regressions, so the checks that gate a merge need to be stronger.
   Build + unit tests confirm code compiles and pure logic holds, but they don't
   exercise the real auth/billing flows a dependency bump could break at runtime.

The first real E2E-in-CI run immediately caught drift the local-only policy had
hidden: the sign-up spec predated the required ToS/Privacy checkbox (ADR-0015)
and had been silently broken.

## Decision

Run Playwright E2E in CI, but **only where it earns its keep** — on unattended
merges:

- A dedicated `e2e.yml` workflow runs the suite against a Postgres **service
  container**, with Playwright browser binaries **cached** by version.
- The `e2e` job does real work **only** for Dependabot PRs, a manual
  `workflow_dispatch`, or when a human opts a feature PR in with the **`run-e2e`
  label**. Ordinary feature PRs skip it — those are exercised by hand.
- An always-running **`E2E gate`** job is the required status check: it passes
  when E2E succeeded or was intentionally skipped, and fails only when E2E
  actually failed. This lets E2E gate Dependabot merges without slowing the
  feature PRs a human is already testing.

## Consequences

- Dependabot patch/minor bumps can auto-merge with a runtime safety net; a green
  build + unit tests is no longer the whole story for unattended merges.
- Feature-PR iteration speed is unchanged (E2E is opt-in via `run-e2e`).
- The E2E suite is now load-bearing, so it must be kept in sync with the app —
  CI enforces that for the flows it covers.
- Major bumps still don't auto-merge (E2E isn't exhaustive); those stay manual.
