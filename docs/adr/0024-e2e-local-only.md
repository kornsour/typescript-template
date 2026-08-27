# ADR-0024: Run Playwright E2E locally, never in GitHub Actions

- Status: Accepted
- Date: 2026-08-17
- Supersedes: [ADR-0017](./0017-e2e-in-ci-for-dependabot.md)

## Context

GitHub-hosted Playwright runs duplicate validation that can be performed in a
developer's isolated local environment while consuming Actions minutes and
runner setup time.

## Decision

Remove the GitHub Actions E2E workflow and its required-check gate. Keep the
Playwright suite and its local commands (`pnpm e2e`, `pnpm e2e:ui`) intact.
PR CI continues to run lint, type checking, unit tests, migration validation,
builds, and the production-render smoke test.

## Consequences

Contributors run E2E locally before merging changes to a covered flow or
releasing. No GitHub Actions trigger, label, manual dispatch, or Dependabot PR
may run Playwright.
