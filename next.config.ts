import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every response.
 * See docs/adr/0009-security-headers.md.
 *
 * The Content-Security-Policy is NOT set here — it's a per-request nonce-based
 * policy set in `src/proxy.ts` (see docs/adr/0014-content-security-policy.md).
 * Tighten that policy to each app's real origins.
 */
const securityHeaders = [
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{
		key: "Strict-Transport-Security",
		value: "max-age=63072000; includeSubDomains; preload",
	},
	{ key: "X-DNS-Prefetch-Control", value: "on" },
	{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
	// The subscription-CLI adapters are local-dev-only (see ADR-0022) and are
	// loaded lazily in src/lib/ai/provider.ts. Marking them external keeps them
	// (and the Claude Agent SDK they pull in) out of the server bundle entirely.
	serverExternalPackages: ["ai-sdk-provider-claude-code", "ai-sdk-provider-codex-cli"],
	async headers() {
		return [
			{
				source: "/:path*",
				headers: securityHeaders,
			},
		];
	},
};

export default nextConfig;
