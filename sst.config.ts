/// <reference path="./.sst/platform/config.d.ts" />

/**
 * Deploy target: AWS via SST v4 + OpenNext. See docs/adr/0023-aws-sst-deploy.md,
 * and AWS-MIGRATION.md in the shared `.github` repo for the fleet-wide plan.
 *
 * NOTE ON TYPE-CHECKING: this file is excluded from `tsconfig.json`. The
 * reference above pulls in SST's *generated platform sources*, and those do not
 * compile under this repo's TypeScript 6 + `strict` + `noUncheckedIndexedAccess`
 * settings — errors in SST's own code, not in this config. Relaxing the app's
 * settings to accommodate them would cost far more than it buys, so the config
 * is validated the way SST validates it instead:
 *
 *     pnpm sst:check      # runs `sst install`, which evaluates this file
 *
 * Biome still lints and formats it (`biome.json` → `*.config.ts`).
 *
 * Shape: Lambda behind CloudFront (`sst.aws.Nextjs`), Cloudflare for DNS, and
 * 14-day CloudWatch log retention on every log group.
 *
 * ┌─ Things worth knowing before you run `sst deploy` ─────────────────────────┐
 * │ • DATABASE_URL must be a *.neon.tech host. src/db/driver.ts refuses a TCP  │
 * │   `pg` pool inside Lambda: a pool per concurrent invocation exhausts       │
 * │   Neon's connection limit long before real load.                          │
 * │ • CloudWatch log retention defaults to *never expire*. Log groups          │
 * │   accumulating forever is the line item that actually shows up on the      │
 * │   bill at this traffic level, so it is set here, not "later".             │
 * │ • The ACM certificate must be in us-east-1 — CloudFront reads certs from   │
 * │   nowhere else. `sst.aws.Nextjs` handles that when `domain.dns` is set.    │
 * │ • Cold starts are the honest regression versus Vercel: at ~zero traffic    │
 * │   every visitor pays 1–3s. The mitigation is CloudFront caching static     │
 * │   and ISR responses, not provisioned concurrency (~$5/mo/app would erase   │
 * │   the entire saving).                                                     │
 * │ • Migrations do NOT run as part of this deploy. Vercel's build hook used   │
 * │   to apply them; on AWS `pnpm db:deploy` runs as an explicit step first    │
 * │   (.github/workflows/deploy.yml).                                          │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Secrets are `sst.Secret`, set once per stage with:
 *     npx sst secret set BetterAuthSecret "$(openssl rand -base64 32)" --stage production
 */

// Must match package.json's `name` — SST rejects top-level imports in this
// file, so it cannot be read from there. `scripts/rename-app.sh` rewrites both
// together; if you rename by hand, change both.
const APP_NAME = "typescript-template";

export default $config({
	app(input) {
		return {
			name: APP_NAME,
			// `remove` on a throwaway stage, `retain` on production — a stack delete
			// must never be able to take a data store with it.
			removal: input?.stage === "production" ? "retain" : "remove",
			protect: input?.stage === "production",
			home: "aws",
			providers: {
				aws: { region: "us-east-1" },
				// DNS lives on Cloudflare (free) rather than Route 53 ($0.50/zone/mo).
				// Needs a token scoped to Zone:DNS:Edit in CLOUDFLARE_API_TOKEN.
				cloudflare: "6.19.0",
			},
		};
	},

	async run() {
		const isProduction = $app.stage === "production";

		/* ------------------------------- Secrets ------------------------------- */
		// Values live in SST's encrypted parameter store, never in this file.
		const databaseUrl = new sst.Secret("DatabaseUrl");
		const betterAuthSecret = new sst.Secret("BetterAuthSecret");

		/* ------------------------------- The app -------------------------------- */
		const web = new sst.aws.Nextjs("Web", {
			domain: domainConfig(),
			environment: {
				NEXT_PUBLIC_APP_URL: appUrl(),
				// The signal that replaces VERCEL_ENV. src/lib/ai/deployment-boundary.ts
				// reads it to keep subscription-CLI models out of deployed builds
				// (ADR-0022) — without it, moving off Vercel would disarm that guard.
				DEPLOY_ENV: isProduction ? "production" : "preview",
				AWS_REGION: "us-east-1",

				DATABASE_URL: databaseUrl.value,
				BETTER_AUTH_SECRET: betterAuthSecret.value,
			},
			transform: {
				// CloudWatch's default retention is "never expire". Setting it here,
				// on every log group SST creates, is the difference between ~$0 and a
				// slowly growing bill for logs nobody will ever read.
				server: {
					logging: { retention: "2 weeks" },
				},
			},
		});

		return {
			url: web.url,
		};
	},
});

/**
 * Per-stage hostname, implementing ADR-0019 on AWS: a subdomain of one shared
 * zone by default, promoted to a dedicated apex domain when an app earns it.
 *
 * - Default:           `‹app›.$APPS_DOMAIN`
 * - Set `APP_DOMAIN`:  that apex, with `www.` redirecting to it
 *
 * Non-production stages get SST's generated CloudFront URL, so a preview stage
 * never needs a certificate or a DNS record.
 *
 * `scripts/add-app-domain.sh` did this against Vercel's API and is deprecated:
 * `sst.aws.Nextjs` provisions the us-east-1 ACM certificate and the Cloudflare
 * record itself from what this function returns.
 */
function domainConfig() {
	if ($app.stage !== "production") return undefined;

	const apex = process.env.APP_DOMAIN;
	const dns = sst.cloudflare.dns({ zone: process.env.CLOUDFLARE_ZONE_ID ?? "" });

	// `redirects` sends www to the apex; `aliases` would instead serve both,
	// splitting the canonical URL in two. Every app here wants the redirect.
	if (apex) return { name: apex, redirects: [`www.${apex}`], dns };

	return { name: sharedZoneHost(), dns };
}

function sharedZoneHost(): string {
	const zone = process.env.APPS_DOMAIN ?? "uresu.app";
	return `${$app.name}.${zone}`;
}

function appUrl(): string {
	if ($app.stage !== "production") return "http://localhost:3000";
	const apex = process.env.APP_DOMAIN;
	return `https://${apex ?? sharedZoneHost()}`;
}
