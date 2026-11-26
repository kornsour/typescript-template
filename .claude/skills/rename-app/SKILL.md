---
name: rename-app
description: Rebrand a fresh copy of this template to a new app name — updates package.json, layout title/metadata, README, the local dev database name, and the mobile app identity, or removes the mobile app for a web-only project. Use right after copying the template to start a new project.
---

# Rename a fresh template copy

Run once, immediately after copying the template into a new directory, to give
the project its identity.

## First ask: web + mobile, or web only?

The template ships a Next.js app (repo root) and an Expo app (`mobile/`). Ask the
user before running anything, unless they already said. Removal is one-way, so
don't choose it for them.

**Web + mobile.** Also ask for the iOS bundle identifier / Android package
(reverse domain, e.g. `com.acme.recipebox`). It is hard to change after a store
release. Without one it defaults to `com.example.<name without hyphens>`, a
placeholder to replace before publishing.

```bash
bash scripts/rename-app.sh <new-app-name>   # lowercase kebab-case, e.g. recipe-box
bash scripts/rename-app.sh <new-app-name> --bundle-id com.acme.recipebox
```

**Web only.**

```bash
bash scripts/rename-app.sh <new-app-name> --web-only
```

This renames, then runs `scripts/remove-mobile.sh` (also available later as
`pnpm mobile:remove`): it deletes `mobile/`, stubs `src/lib/auth/mobile.ts`,
drops the mobile scripts and CI entries, and runs `pnpm install`.
`shared/` and `/api/me` stay. Docs prose is not rewritten, so update README and
CLAUDE.md mentions of the mobile app afterward.

## What the rename updates

- `package.json` `name` and `APP_NAME` in `sst.config.ts`
- `src/app/layout.tsx` metadata title (default + template)
- the home page heading, its assertion in `e2e/home.spec.ts`, and the README title
- the local dev database name in `.env` / `.env.example` (`<name>_dev`)
- `mobile/app.json`: `name`, `slug`, `scheme`, `ios.bundleIdentifier`,
  `android.package`
- `APP_SCHEME` in `shared/src/app.ts`, which must equal `expo.scheme` (change
  both together if editing by hand)

A name that starts with a digit gets an `app` prefix where the platforms require
a leading letter: scheme `app-<name>`, bundle id `com.example.app<name>`.

Then review the diff and finish setup:
```bash
git diff
pnpm bootstrap    # env files, secret, local DB, migrations
pnpm dev          # web; with mobile: pnpm dev:all
```

Do a repo-wide search for any other literal "TypeScript Template" / "typescript-template"
strings (README prose, docs) and update them to taste — the script covers the
functional references, not every mention.

Next, provision external services with the `provision-app` skill.
