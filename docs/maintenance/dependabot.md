# Dependabot auto-merge

How dependency updates flow through CI and merge themselves when safe. Config
lives in `.github/dependabot.yml`; the automation in
`.github/workflows/dependabot-auto-merge.yml`.

## Policy

| Update type | Behaviour |
|-------------|-----------|
| **patch** (`x.y.Z`) | Auto-merges once all required checks pass |
| **minor** (`x.Y.z`) | Auto-merges once all required checks pass |
| **major** (`X.y.z`) | **Left for manual review** — E2E isn't exhaustive, so a breaking major could pass build + unit tests and still break auth/billing at runtime |

Applies to both ecosystems Dependabot watches (npm + GitHub Actions).

## How it works

1. Dependabot opens a PR (grouped per `.github/dependabot.yml`).
2. `dependabot-auto-merge.yml` reads the semver bump via
   `dependabot/fetch-metadata`. For patch/minor it calls
   `gh pr merge --auto --squash`.
3. GitHub's **native auto-merge** holds the PR until every **required status
   check** passes, then squash-merges. Nothing merges on red.

### What gates a merge

Required status checks on the `main` ruleset:

- **Lockfile integrity** — rejects duplicate-key `pnpm-lock.yaml` corruption
  (see [pnpm-lockfile.md](./pnpm-lockfile.md); this is the recurring Dependabot
  break, so it's the most important guard for unattended merges).
- **Lint & format (Biome)**, **Type check**, **Unit tests (Vitest)**,
  **Build**, **DB migration check**.
- **E2E gate** — Playwright runs for real on Dependabot PRs (see
  [ADR-0017](../adr/0017-e2e-in-ci-for-dependabot.md)).

CodeQL (default code scanning) also runs on PRs but is intentionally **not**
required — it scans our code, not the bumped dependency, and requiring it risks
wedging auto-merge on edge cases. Add it to the ruleset's required checks if you
want a hard security gate.

## Overriding

- **Block an auto-merge you don't want**: review the PR before checks finish and
  `gh pr merge --disable-auto <url>`, or convert it to a draft.
- **Force a major through** (after reviewing): approve and
  `gh pr merge --squash <url>` manually.
- **Run E2E on a non-Dependabot PR**: add the **`run-e2e`** label (or trigger
  `e2e.yml` via `workflow_dispatch`).

## When the lockfile breaks despite the guard

The lockfile guard should now catch duplicate-key corruption before merge. If
`main` still goes red on a lockfile parse error, follow the surgical-fix runbook
in [pnpm-lockfile.md](./pnpm-lockfile.md), then `@dependabot recreate` (not just
`rebase`) on any stuck PRs.
