/** Port `pnpm dev` serves the web app on. */
export const DEV_WEB_PORT = 3000;

export interface ApiUrlInput {
	/** `EXPO_PUBLIC_API_URL`, if set. */
	envUrl: string | undefined;
	/** Expo dev server address, e.g. "192.168.1.20:8081" (`Constants.expoConfig.hostUri`). */
	hostUri: string | undefined;
	isDev: boolean;
	/** `Platform.OS` */
	platform: string;
}

const ORIGIN = /^https?:\/\/(\[[0-9a-f:.]+\]|[^\s/?#:@[\]]+)(:\d+)?$/i;

/** Extracts the host (without port) from "host:port", "[v6]:port" or a URL-like string. */
function hostOf(hostUri: string): string | undefined {
	const authority = hostUri.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split(/[/?#]/)[0] ?? "";
	return authority.match(/^(\[[^\]]+\]|[^:]+)/)?.[1];
}

/**
 * Origin of the web app that serves the API.
 *
 * An explicit `EXPO_PUBLIC_API_URL` always wins. Otherwise, in development only,
 * the web app is assumed to run on the same machine as the Expo dev server.
 */
export function resolveApiUrl({ envUrl, hostUri, isDev, platform }: ApiUrlInput): string {
	const explicit = envUrl?.trim().replace(/\/+$/, "");
	if (explicit) {
		if (!ORIGIN.test(explicit)) {
			throw new Error(
				`EXPO_PUBLIC_API_URL must be an http(s) origin such as https://app.example.com, got "${explicit}".`,
			);
		}
		return explicit;
	}

	if (!isDev) {
		throw new Error(
			"EXPO_PUBLIC_API_URL is not set. Production builds need the URL of the deployed web app.",
		);
	}

	const host = hostUri ? hostOf(hostUri) : undefined;

	// An Expo tunnel only forwards the Metro server, not the web app.
	if (host?.endsWith(".exp.direct")) {
		throw new Error(
			"Expo tunnel mode can't reach your local web app. Set EXPO_PUBLIC_API_URL to a URL the device can open.",
		);
	}

	const isLoopback = !host || host === "localhost" || host === "127.0.0.1" || host === "[::1]";
	if (!isLoopback) return `http://${host}:${DEV_WEB_PORT}`;

	// Inside the Android emulator, "localhost" is the emulator itself; 10.0.2.2 is the host machine.
	const fallback = platform === "android" ? "10.0.2.2" : "localhost";
	return `http://${fallback}:${DEV_WEB_PORT}`;
}
