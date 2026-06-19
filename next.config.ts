import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every response.
 *
 * A Content-Security-Policy is intentionally omitted: a strict CSP needs
 * per-app tuning (and usually a nonce set in middleware) and a wrong one
 * silently breaks the app. Add one per project once the asset/script
 * origins are known. See docs/adr/0009-security-headers.md.
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
