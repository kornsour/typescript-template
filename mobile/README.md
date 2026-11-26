# Mobile app

Expo (Expo Router) client for the web app at the repo root. It shares validation
and the API contract through `@app/shared` and never imports server code.

## Run it

```bash
pnpm dev          # web app + API on :3000 (from the repo root)
pnpm dev:mobile   # Expo dev server; press i / a, or scan the QR code
```

With `EXPO_PUBLIC_API_URL` unset, a development build calls port 3000 on the
machine running Expo (`10.0.2.2` / `localhost` as the emulator fallback). A
physical phone must be on the same network, with port 3000 reachable. Set the
variable (see `.env.example`) for tunnel mode, another port, or any production
build. The Terms and Privacy links open on that same origin.

## Layout

```
src/app/          routes: (auth)/ is signed-out only, (app)/ is signed-in only
src/components/   UI primitives
src/lib/          auth client, API client, validation
src/theme.ts      colors (light/dark) and spacing
```

## Add a screen and an API call

1. **Contract**: in `shared/src/api.ts`, export the path and a Zod response
   schema.
2. **Server**: add the route handler under the web app's `src/app/api/`. Check the
   session there and return 401 when there is none. The app's route guard is UX,
   not security.
3. **Client**: add a function next to `fetchMe` in `src/lib/api-client.ts` using
   `apiGet`, then expose it on `api` in `src/lib/api.ts`. Test it in
   `api-client.test.ts`.
4. **Screen**: create `src/app/(app)/things.tsx`; the file name is the route
   (`/things`) and the group makes it require sign-in.

```tsx
export default function ThingsScreen() {
	const { state, reload } = useApi(api.things); // a stable function reference
	if (state.status === "loading") return <Loading />;
	// render state.error.message with a retry button, or state.data
}
```

Link to it with `<Link href="/things">` or `router.push("/things")`.

`apiGet` only reads. For writes, add a sibling that sends the same cookie with a
method and JSON body.

## Checks

```bash
pnpm mobile:check   # typecheck, unit tests, dependency versions (repo root)
```

Unit tests run in Node, so keep tested modules free of `react-native` and
`expo-*` imports. Install native dependencies with
`pnpm --filter mobile exec expo install <package>` so versions match the SDK.
