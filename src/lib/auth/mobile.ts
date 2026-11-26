import { APP_SCHEME } from "@app/shared/app";
import type { BetterAuthPlugin } from "better-auth";
import { env } from "@/env";

/**
 * Everything the auth server needs for the Expo app. `scripts/remove-mobile.sh`
 * overwrites this file with empty arrays for web-only projects, so keep the two
 * export names stable.
 */

/**
 * A native app sends no `Origin` header, so better-auth's Expo client sends
 * `expo-origin` instead. Copy it across (never over a real `Origin`, which every
 * browser sends cross-origin) so the normal trusted-origin check applies to it.
 *
 * This is the email/password subset of the server plugin in `@better-auth/expo`,
 * kept here on purpose: depending on that package from the web app makes pnpm
 * install a second copy of Expo, which breaks native dependency checks. Adding
 * native social sign-in needs the full plugin — see ADR-0026.
 */
const expoOrigin = {
	id: "expo-origin",
	async onRequest(request: Request) {
		const origin = request.headers.get("expo-origin");
		if (!origin || request.headers.get("origin")) return;
		try {
			// In place first: Next.js passes a NextRequest, which `new Request()`
			// cannot copy (it throws on a private field).
			request.headers.set("origin", origin);
			return { request };
		} catch {
			// Runtimes with immutable incoming headers need a copy.
			const headers = new Headers(request.headers);
			headers.set("origin", origin);
			return { request: new Request(request, { headers }) };
		}
	},
} satisfies BetterAuthPlugin;

export const mobilePlugins = [expoOrigin] as const;

/**
 * Deep-link origins the auth server accepts, on top of its own base URL. A
 * custom-scheme entry only ever matches that scheme, so web origin and redirect
 * checks are unaffected.
 *
 * `exp://` is Expo Go. It matches *any* Expo project on any host, so it must stay
 * development-only.
 */
export const mobileTrustedOrigins: string[] = [
	`${APP_SCHEME}://`,
	...(env.NODE_ENV === "development" ? ["exp://"] : []),
];
