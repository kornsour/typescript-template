# ADR-0018: Centralize CI & Dependabot automation in reusable workflows

- Status: Accepted
- Date: 2026-07-07

## Context

Every repo created from this template carried its own copy-pasted CI, lockfile
guard, and Dependabot auto-merge workflows. Across a growing fleet of
template-derived apps these drifted (different job names, missing checks), and a
personal GitHub account has no organization-level rulesets or required workflows
to enforce a standard centrally.

## Decision

Extract the shared logic into **reusable workflows** in a central public repo,
[`kornsour/gh-automation`](https://github.com/kornsour/gh-automation), and have
every consuming repo — including this template — call them via thin callers:

- `ci.yml` — Biome, type-check, Vitest, build, and (input-gated) a
  schema/migration check.
- `lockfile-guard.yml` — duplicate-key `pnpm-lock.yaml` guard.
- `dependabot-auto-merge.yml` — patch/minor auto-merge; majors manual.

E2E stays a **standalone per-repo workflow** (`e2e.yml`) — it's app-specific
(DB, specs) and Dependabot-gated (see [ADR-0017](./0017-e2e-in-ci-for-dependabot.md)).

## Consequences

- CI logic is maintained in one place; a fix propagates to all repos that call
  `@main` without editing each repo.
- Reusable-workflow check contexts are **prefixed by the caller job name**, e.g.
  `ci / Build`, `lockfile / integrity`. Rulesets must require those names.
- `gh-automation` must be **public**: GitHub blocks public repos from calling a
  private repo's reusable workflow.
- Per-repo pieces that GitHub can't centralize on a personal account remain
  per-repo: `.github/dependabot.yml`, the `allow_auto_merge` setting, and the
  branch ruleset. `scripts/check-lockfile.sh` is retained as a local dev tool;
  CI now uses the reusable guard.
- This template is no longer fully self-contained — its CI depends on
  `kornsour/gh-automation`. That coupling is intentional: it keeps the whole
  fleet standardized.
