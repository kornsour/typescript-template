# Mobile app (Expo)

`mobile/` is an Expo SDK 58 app (expo-router, plain React Native `StyleSheet`)
that uses the web app at the repo root as its backend. Validation, constants, and
the API contract live in `shared/` (`@app/shared`). The reasoning is in
[ADR-0026](../adr/0026-web-and-mobile-workspace.md); the screen-level notes are in
[`mobile/README.md`](../../mobile/README.md).

It ships email/password sign-up and sign-in (with resending the verification
email), a signed-in home screen that reads `GET /api/me`, and sign-out. The
session cookie is stored with `expo-secure-store`.

Web only? Skip to [Removing the mobile app](#removing-the-mobile-app).

## Run it

```bash
pnpm bootstrap    # also creates mobile/.env from mobile/.env.example
pnpm dev:all      # web server + Expo dev server in one terminal
```

Or use two terminals: `pnpm dev` and `pnpm dev:mobile`. The app is useless
without the web server, which serves its API. In the Expo terminal, press `a`
(Android emulator) or `i` (iOS Simulator, macOS only), or scan the QR code with a
phone. `pnpm preflight` reports what is missing for mobile work.

| Target | Needs | Reaching the web server |
|--------|-------|-------------------------|
| Android emulator | Android Studio / SDK | automatic |
| iOS Simulator | macOS + Xcode | automatic |
| Physical phone | Expo Go or a development build | same network as your computer, port 3000 reachable (check the firewall) |

**Expo Go can lag the newest SDK.** If the store build of Expo Go refuses to open
the project, use an emulator/simulator that Expo CLI can install a matching Expo
Go on, or make a local development build with
`pnpm --filter mobile exec expo run:android` (or `run:ios`). That needs the native
toolchain and generates `mobile/android/` / `mobile/ios/` (git-ignored); review
`git diff` afterward, since Expo may also edit `mobile/package.json`.

**Expo Go only works against a development server.** The auth server trusts the
`exp://` origin only when `NODE_ENV` is `development`, because it matches any Expo
project. A deployed backend accepts the app's own scheme only.

Sign-up works as on the web: locally, verification links print to the web server
console and verification is not required to sign in. The emailed link opens the
web app (it is built from `NEXT_PUBLIC_APP_URL`), not the mobile app.

## Environment

| Variable | Where | Meaning |
|----------|-------|---------|
| `EXPO_PUBLIC_API_URL` | `mobile/.env` | Origin of the web app, e.g. `https://app.example.com` (no path) |

- **Development:** leave it unset. The app calls port 3000 on the machine running
  Expo (falling back to `10.0.2.2` in the Android emulator, `localhost`
  elsewhere). Set it for another port, tunnel mode, or a remote backend.
- **Production builds:** required, or the app fails at startup. Use `https`.
- `EXPO_PUBLIC_*` values are compiled into the app. Never put a secret there.
- Restart the Expo dev server after changing it.

The web app's variables are unchanged (`.env`, `src/env.ts`); mobile needs no new
server variable.

## App identity

`scripts/rename-app.sh <name> [--bundle-id com.acme.myapp]` sets `name`, `slug`,
`scheme`, `ios.bundleIdentifier`, and `android.package` in `mobile/app.json`, and
`APP_SCHEME` in `shared/src/app.ts`. The auth server trusts `APP_SCHEME` and the
app registers `expo.scheme`, so **the two must stay equal** if you edit by hand.
The default `com.example.*` identifier is a placeholder; replace it before any
store submission.

## Add a feature

The order keeps both clients on one contract. `/api/me` is the worked example.

1. **Shared contract and validation** (`shared/src/`): input schemas and rules
   used by both clients, plus the route path and response schema, as in
   `shared/src/api.ts`. A new file also needs an entry in `exports` in
   `shared/package.json`. Keep `shared/` free of server, DOM, and React Native
   code.
2. **Server logic** (`src/lib/…`, `src/db/schema.ts`): the work itself, callable
   from a route and from a server action. Schema changes need a migration
   ([database-migrations.md](../maintenance/database-migrations.md)).
3. **API route** (`src/app/api/<name>/route.ts`) with a session check:

   ```ts
   export const GET = withApiSession((_request, { user }) =>
   	Response.json(meResponseSchema.parse({ user })),
   );
   ```

   `withApiSession()` (`src/lib/auth/api-session.ts`) answers 401 without a
   session and marks responses `private, no-store`. Parsing with the response
   schema strips fields the contract doesn't name. Authorize access to the
   specific records too, not only the session. `src/proxy.ts` does not run on
   `/api`.

   **Writes need more.** better-auth's CSRF protection covers only `/api/auth/*`,
   so a route that changes state must also verify the request origin itself. The
   template has no helper or example for this yet, and the mobile client sends only
   the cookie on app routes: design the check, and what the app sends to pass it,
   with your first write route.
4. **Web page** (`src/app/…`): gate with `requireUser()`; server actions are fine
   here.
5. **Mobile screen**: add a fetch function in `mobile/src/lib/api-client.ts`
   (`apiGet` is read-only), expose it in `mobile/src/lib/api.ts`, then add
   `mobile/src/app/(app)/<name>.tsx` and read it with `useApi`. The mobile app
   never calls server actions or imports from `src/`.
6. **Test**: `pnpm test` (web and shared) and `pnpm mobile:check`. Mobile unit
   tests run in Node, so keep tested modules free of `react-native` and `expo-*`
   imports.

Install native packages with
`pnpm --filter mobile exec expo install <package>` so versions match the SDK.

Installed apps update later than the web deploy. Add fields rather than renaming
or removing them, or version the route.

## Checks and CI

```bash
pnpm mobile:check   # type check, unit tests, expo install --check
pnpm --filter mobile exec expo export --platform android --platform ios --output-dir /tmp/mobile-export
```

CI runs both as the required check `Mobile (type check, tests)`. There the
version check is offline (`EXPO_OFFLINE=1`): it compares `mobile/` with the
version map inside the installed `expo` package, so newer Expo patch releases
don't fail unrelated PRs, and `typescript` / `@types/react` are not checked.
Neither command runs the app, so try changed screens on a device or emulator.

A repo created from the template must apply the ruleset to make the check
required: `scripts/setup-branch-protection.sh <owner>/<repo>` (again, if it was
applied before the mobile check was added).

## Upgrading the Expo SDK

Dependabot does not bump Expo or React Native packages
([dependabot.md](../maintenance/dependabot.md)), so this is manual, for patch
releases as well as new SDKs. Run it with network access (no `EXPO_OFFLINE`).

1. For a new SDK, read its release notes, and upgrade one SDK version at a time.
2. New SDK only:
   `pnpm --filter mobile exec expo install expo@^<major>.0.0`
3. Align everything the SDK manages:
   `pnpm --filter mobile exec expo install --fix`
4. Check `mobile/package.json` for `react`, `react-dom`, `@types/react`, and
   `typescript`. They follow the SDK and may differ from the root versions; don't
   copy mobile's versions to the web app or the reverse.
5. Run `pnpm mobile:check`, the export command above, `pnpm check`, and
   `pnpm test`; then try the app on iOS and Android.
6. Commit `mobile/package.json` and `pnpm-lock.yaml` together. If you made local
   native builds, delete `mobile/ios` / `mobile/android` so they regenerate.

Root `pnpm.overrides` in `package.json` also apply to the mobile dependency tree;
check them if an upgrade fails to bundle.

## Removing the mobile app

```bash
pnpm mobile:remove                              # existing project
bash scripts/rename-app.sh my-app --web-only    # while naming a new one
```

One-way, so commit first. It deletes `mobile/` and `scripts/dev-all.sh`, empties
the server seam `src/lib/auth/mobile.ts`, drops the mobile
scripts, the CI job, the Dependabot rules, and the required check from the ruleset
file, then updates the lockfile. `shared/` and `/api/me` stay. Documentation is
not rewritten. Re-run `scripts/setup-branch-protection.sh` if the ruleset was
already applied on GitHub, or merges will wait on a check that never runs.

## Behavior to know

- **Sign-out** clears the device first. If the server can't be reached, the
  server-side session stays valid until it expires.
- **Terms updates:** `LEGAL_VERSION` is compiled into the app and the server
  requires an exact match, so after a bump, sign-up fails in installed builds
  until they update. Once the app is in a store, release the update alongside the
  web change, or have the app fetch the version from an API route.

## Deferred

Not built:

- **Native Google / Apple sign-in.** The app offers email/password only, so users
  who signed up on the web with Google or Apple can't use those buttons here.
  It also needs more server support than `src/lib/auth/mobile.ts` has today
  ([ADR-0026](../adr/0026-web-and-mobile-workspace.md)).
- **Password reset screen.** Use the web app's forgot-password page.
- **Mobile payments.** Store payment rules apply, and Apple's rules on external
  purchase links differ between the US storefront and others. Check current
  guidelines before adding any purchase flow or link.
- **Store release and EAS** (no `eas.json`, icons, or splash screen configured).
- **In-app account deletion.**
- **A design system matching the web** ([ADR-0020](../adr/0020-design-system.md)).

## Release checklist (outline)

Verify each store requirement against the current guidelines.

- [ ] In-app account deletion. Apple guideline 5.1.1(v) is understood to require
      it for apps that offer account creation; confirm before release.
      `src/lib/auth.ts` does not enable account deletion today, and Google Play
      has its own deletion requirements.
- [ ] Own bundle identifier / package, app name, icons, splash screen, versioning.
- [ ] Build and signing pipeline (EAS or native), developer accounts.
- [ ] `EXPO_PUBLIC_API_URL` set to the production `https` origin in release builds.
- [ ] Production email configured, since verification is required to sign in.
- [ ] Privacy policy URL, store privacy declarations, and legal pages reviewed for
      the mobile app ([legal.md](../legal.md)).
- [ ] If adding social sign-in or payments, review the store rules for each first.
- [ ] Demo account for store review.
- [ ] API backward compatibility plan for already-installed versions.
- [ ] Manual pass on physical iOS and Android devices against production.
