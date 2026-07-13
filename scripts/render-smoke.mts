#!/usr/bin/env node
/**
 * Production-render smoke test.
 *
 * Boots the built app with `next start` — the real production server, so the
 * strict nonce Content-Security-Policy from src/proxy.ts is live — and asserts
 * that each important route SERVER-renders its real content instead of an empty
 * client-only shell.
 *
 * This is the regression guard for a whole class of bug that is invisible in
 * development: a `"use client"` page that reads `useSearchParams()` prerenders
 * to a blank shell and then never fills in under the production CSP (the
 * reset-password blank-screen bug, fixed by reading params server-side). `pnpm
 * dev` uses a permissive CSP and the Playwright specs run against the dev
 * server, so neither ever exercised the failure. This does, against a real
 * `next build && next start`.
 *
 * The CSP guard below also makes the smoke fail loudly if it is ever pointed at
 * a dev server — a green run against the wrong server would be worse than none.
 *
 * Usage:
 *   node scripts/render-smoke.mts                 # spawns `next start` on PORT (default 3000)
 *   SMOKE_BASE_URL=https://preview… node scripts/render-smoke.mts   # test a running server
 */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

type Check = {
	path: string;
	desc: string;
	/** Every substring here must appear in the response body. */
	contains?: string[];
	/** Optional: a needle that must appear at least `count` times. */
	atLeast?: { needle: string; count: number };
	/** Expected HTTP status (default 200). */
	status?: number;
};

// Functional/heading markers, chosen to survive restyles and app renames where
// possible. The auth routes are the high-risk ones (client components + forms +
// URL params); the reset-password checks are the specific regression guard.
const CHECKS: Check[] = [
	{ path: "/", desc: "home", contains: ["Get started"] },
	{ path: "/sign-in", desc: "sign-in form", contains: ['type="email"', 'type="password"'] },
	{
		path: "/sign-up",
		desc: "sign-up form",
		contains: ['type="email"', 'type="password"', "Create account"],
	},
	{
		path: "/forgot-password",
		desc: "forgot-password form",
		contains: ['type="email"', "Reset your password"],
	},
	{
		path: "/verify-email",
		desc: "resend-verification form",
		contains: ['type="email"', "Resend verification email", "Send verification link"],
	},
	{
		path: "/reset-password?token=smoke-test-token",
		desc: "reset-password with token (regression guard: must NOT be a blank shell)",
		contains: ["New password", "Confirm new password", "Reset password"],
		atLeast: { needle: 'type="password"', count: 2 },
	},
	{
		path: "/reset-password",
		desc: "reset-password without token",
		contains: ["This reset link is invalid or has expired.", "Request a new link"],
	},
	{ path: "/terms", desc: "terms", contains: ["Terms of Service"] },
	{ path: "/privacy", desc: "privacy", contains: ["Privacy Policy"] },
	{ path: "/acceptable-use", desc: "acceptable-use", contains: ["Acceptable Use Policy"] },
	{ path: "/ai-disclosure", desc: "ai-disclosure", contains: ["AI Disclosure"] },
	{ path: "/cookies", desc: "cookies", contains: ["Cookie Policy"] },
];

const PORT = process.env.PORT ?? "3000";
const providedBaseUrl = process.env.SMOKE_BASE_URL;
const baseUrl = providedBaseUrl ?? `http://localhost:${PORT}`;

/** The strict production CSP has 'strict-dynamic' and no 'unsafe-inline' in script-src. */
function assertProductionCsp(cspHeader: string | null, path: string, failures: string[]): void {
	if (!cspHeader) {
		failures.push(`${path}: no content-security-policy response header`);
		return;
	}
	const scriptSrc = cspHeader
		.split(";")
		.map((d) => d.trim())
		.find((d) => d.startsWith("script-src"));
	if (!scriptSrc) {
		failures.push(`${path}: CSP has no script-src directive`);
		return;
	}
	// If we're testing a dev server by mistake, script-src carries 'unsafe-inline'
	// and lacks 'strict-dynamic' — treat that as a hard failure, not a pass.
	if (!scriptSrc.includes("'strict-dynamic'") || scriptSrc.includes("'unsafe-inline'")) {
		failures.push(
			`${path}: script-src is not the strict production policy — refusing to smoke a dev server (got: ${scriptSrc})`,
		);
	}
}

async function runChecks(): Promise<string[]> {
	const failures: string[] = [];
	for (const check of CHECKS) {
		const url = `${baseUrl}${check.path}`;
		let res: Response;
		let body: string;
		try {
			res = await fetch(url, { redirect: "manual" });
			body = await res.text();
		} catch (err) {
			failures.push(`${check.path} (${check.desc}): request failed — ${(err as Error).message}`);
			continue;
		}

		const expectedStatus = check.status ?? 200;
		if (res.status !== expectedStatus) {
			failures.push(`${check.path} (${check.desc}): status ${res.status}, expected ${expectedStatus}`);
		}

		assertProductionCsp(res.headers.get("content-security-policy"), check.path, failures);

		for (const needle of check.contains ?? []) {
			if (!body.includes(needle)) {
				failures.push(
					`${check.path} (${check.desc}): server HTML is missing ${JSON.stringify(needle)} — blank/partial render?`,
				);
			}
		}
		if (check.atLeast) {
			const count = body.split(check.atLeast.needle).length - 1;
			if (count < check.atLeast.count) {
				failures.push(
					`${check.path} (${check.desc}): found ${count}× ${JSON.stringify(check.atLeast.needle)}, expected ≥ ${check.atLeast.count}`,
				);
			}
		}

		if (!failures.some((f) => f.startsWith(check.path))) {
			console.log(`  ✓ ${check.path} — ${check.desc}`);
		} else {
			console.log(`  ✗ ${check.path} — ${check.desc}`);
		}
	}
	return failures;
}

async function waitForServer(timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(baseUrl, { redirect: "manual" });
			if (res.status < 500) return true;
		} catch {
			// not up yet
		}
		await sleep(500);
	}
	return false;
}

async function main(): Promise<void> {
	console.log(`Render smoke against ${baseUrl}`);

	// When a base URL is supplied, assume the caller manages the server.
	if (providedBaseUrl) {
		const failures = await runChecks();
		report(failures);
		return;
	}

	// Otherwise boot the production server ourselves.
	const server = spawn("pnpm", ["exec", "next", "start", "-p", PORT], {
		stdio: ["ignore", "inherit", "inherit"],
		env: process.env,
	});
	let serverExited = false;
	server.on("exit", () => {
		serverExited = true;
	});

	try {
		const ready = await waitForServer(60_000);
		if (!ready || serverExited) {
			console.error("✗ Production server did not become ready within 60s");
			process.exitCode = 1;
			return;
		}
		const failures = await runChecks();
		report(failures);
	} finally {
		if (!serverExited) server.kill("SIGTERM");
	}
}

function report(failures: string[]): void {
	if (failures.length === 0) {
		console.log(`\n✓ Render smoke passed (${CHECKS.length} routes).`);
		return;
	}
	console.error(`\n✗ Render smoke failed with ${failures.length} problem(s):`);
	for (const f of failures) console.error(`  • ${f}`);
	process.exitCode = 1;
}

await main();
