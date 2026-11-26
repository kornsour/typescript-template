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

CI, the lockfile guard, and auto-merge come from reusable workflows in
[`kornsour/gh-automation`](https://github.com/kornsour/gh-automation)
([ADR-0018](../adr/0018-reusable-ci-workflows.md)), so the check contexts are
prefixed by the caller job name. Required status checks on the `main` ruleset:

- **`lockfile / integrity`** — rejects duplicate-key `pnpm-lock.yaml` corruption
  (see [pnpm-lockfile.md](./pnpm-lockfile.md); the recurring Dependabot break, so
  the most important guard for unattended merges).
- **`ci / Lint & format (Biome)`**, **`ci / Type check`**,
  **`ci / Unit tests (Vitest)`**, **`ci / Build`**, **`ci / DB migration check`**.
- **`Mobile (type check, tests)`** — a local job in `ci.yml` (no caller prefix);
  see [ADR-0026](../adr/0026-web-and-mobile-workspace.md). Removed along with the
  mobile app.
- **`Gitleaks (full history)`** — the secret scan (`secret-scan.yml`). It covers
  all history, so a finding blocks every PR until the credential is revoked or a
  reviewed false positive is added to `.gitleaksignore`.

Editing `.github/rulesets/default-branch.json` changes nothing on GitHub by
itself: apply it with `scripts/setup-branch-protection.sh`, in this repo and in
each derived repo, after the job it requires is on the default branch.

CodeQL (default code scanning) also runs on PRs but is intentionally **not**
required — it scans our code, not the bumped dependency, and requiring it risks
wedging auto-merge on edge cases. Add it to the ruleset's required checks if you
want a hard security gate.

## Expo SDK packages (mobile)

- **Ignored for version updates**: `expo`, `expo-*`, `@expo/*`, `jest-expo`,
  `babel-preset-expo`, `react-native`, `react-native-*`, `@react-native/*`,
  `@react-native-*`. Upgrade them together with `expo install --fix`
  ([mobile.md](../setup/mobile.md#upgrading-the-expo-sdk)). The rules list
  `update-types`, which leaves security updates able to open a PR.
- **Grouped separately** (`shared-with-expo`): `react`, `react-dom`,
  `@types/react`, `typescript`. The web app uses them too, so they still get
  updates. If such a PR moves `mobile/package.json`'s `react` or `react-dom` off
  the SDK's version, the Mobile check fails: restore the versions in
  `mobile/package.json`, update the lockfile, and push. The CI check is offline
  and does not catch `typescript` or `@types/react` drift in `mobile/`, so look at
  `mobile/package.json` in the diff of such a PR.

## Overriding

- **Block an auto-merge you don't want**: review the PR before checks finish and
  `gh pr merge --disable-auto <url>`, or convert it to a draft.
- **Force a major through** (after reviewing): approve and
  `gh pr merge --squash <url>` manually.
- **Run E2E locally before merging a covered change**: `pnpm e2e`.

## When the lockfile breaks despite the guard

The lockfile guard should now catch duplicate-key corruption before merge. If
`main` still goes red on a lockfile parse error, follow the surgical-fix runbook
in [pnpm-lockfile.md](./pnpm-lockfile.md), then `@dependabot recreate` (not just
`rebase`) on any stuck PRs.
