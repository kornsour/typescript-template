# ADR-0026: Web and mobile in one pnpm workspace

- Status: Accepted
- Date: 2026-11-26

## Context

New ideas built from this template should be able to ship on the web and on
mobile, against one backend, one database, and one set of validation rules. The
template's existing automation assumes the web app lives at the repository root:
the SST deploy, the reusable CI workflows from `kornsour/gh-automation`
([ADR-0018](./0018-reusable-ci-workflows.md)), the DB migration check (which
looks for `src/db/schema.ts` and `drizzle/`), and the repo's own scripts.
Not every derived app needs a mobile client.

## Decision

Add the mobile app **beside** the web app in a pnpm workspace:

| Path | Package | Role |
| --- | --- | --- |
| repo root | (the web app) | Next.js app and backend. Stays at the root; not moved to `apps/web`. |
| `mobile/` | `mobile` | Expo SDK 58 app: expo-router, plain React Native `StyleSheet`. |
| `shared/` | `@app/shared` | Validation, constants, and the HTTP API contract, shipped as TypeScript source. |

- **The API is the boundary.** The mobile app calls HTTP routes (better-auth's
  `/api/auth/*` plus app routes under `src/app/api/`), never Server Actions.
  Each app route checks the session itself, and its response shape is a Zod
  schema in `@app/shared` that both sides use.
- **Auth** is email/password through better-auth. The app uses the
  `@better-auth/expo` client. Everything the auth server needs for the app is in
  `src/lib/auth/mobile.ts`: the trusted deep-link origins and a small local plugin
  that copies the client's `expo-origin` header into `Origin` when none was sent.
- **The web app does not depend on `@better-auth/expo`.** Its optional Expo peers
  were also installed in the root's context, with the web app's React and
  TypeScript versions, giving a second copy of Expo and React Native that
  `expo-doctor` rejects. Matching React instead would have meant moving the web
  app back to an older React patch.
- **Mobile is included by default and removable**: `pnpm mobile:remove`
  (`scripts/remove-mobile.sh`), or `scripts/rename-app.sh <name> --web-only`.
  `shared/` stays either way, because the web app depends on it. Mobile-only
  blocks in CI and Dependabot config sit between `# mobile:begin` and
  `# mobile:end` so removal can delete them.
- **The Expo SDK owns its dependency versions.** Dependabot ignores version
  updates for Expo and React Native packages; they move together with
  `expo install --fix`. Packages the web app also uses (`react`, `react-dom`,
  `@types/react`, `typescript`) stay on Dependabot, in their own group.
- **CI** has one job, `Mobile (type check, tests)`, in
  `.github/workflows/ci.yml`: type check, tests, the Expo version check in
  offline mode, and a Metro export for Android and iOS. It is a required status
  check. It is a local job, not a reusable workflow.

Deferred, each needing its own work (and an ADR where it changes a decision):
native Google/Apple sign-in, mobile payments (Apple's external purchase link
rules differ between the US storefront and others), store release and EAS,
in-app account deletion, and a mobile design system matching
[ADR-0020](./0020-design-system.md).

## Consequences

- Existing deploy, CI, and script paths keep working unchanged for the web app.
  The root is both the workspace root and a package, so root-level tools
  (`tsc`, Vitest, Biome) must be told what they cover: the root tsconfig
  excludes `mobile/`, root Vitest includes `shared/`, Biome covers all three.
- A plain `pnpm install` installs mobile dependencies too, including in web-only
  CI jobs and the deploy job, which makes those installs larger. Root
  `pnpm.overrides` apply to the mobile app's dependency tree as well.
- Versions can differ per package: `react`, `react-dom`, and `typescript` in
  `mobile/` follow the Expo SDK, not the web app. A Dependabot PR that moves
  `mobile/`'s `react` off the SDK version fails the Mobile check and needs a
  manual edit.
- The CI version check compares against the version map inside the installed
  `expo` package, so it is reproducible but does not report newer recommended
  patches, and does not check `typescript` or `@types/react`. Both are covered
  by running the online check during upgrades.
- The local plugin covers email/password only. Adding native social sign-in needs
  the OAuth parts of `@better-auth/expo`'s server plugin, which means revisiting
  the duplicate-dependency problem above in a superseding ADR. Check the local
  plugin against upstream when upgrading better-auth.
- Mobile releases are not tied to web deploys: installed app versions lag the
  backend, so API routes must stay backward compatible or be versioned.
- CI proves the app type-checks, tests, and bundles. It does not run it on a
  device or build native binaries.
- Expo Go builds in the app stores can lag the newest SDK, in which case running
  on a physical device needs a development build.
- Derived repos must re-run `scripts/setup-branch-protection.sh` for the new
  required check to apply to them; the ruleset file alone changes nothing.
