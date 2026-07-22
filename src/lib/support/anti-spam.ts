import { createHash } from "node:crypto";
import { and, count, eq, gte } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { supportRequest } from "@/db/schema";
import { env } from "@/env";

/**
 * Anti-abuse checks for the public support form, layered cheapest-first
 * (the honeypot check itself lives in the action — it needs no I/O):
 *
 *   1. Honeypot         — always on, zero dependencies.
 *   2. Turnstile        — optional; verified only when TURNSTILE_SECRET_KEY is
 *                         set (free Cloudflare CAPTCHA alternative).
 *   3. Rate limiting    — always on; sliding-window counts against the
 *                         `support_request` table, so it needs no extra
 *                         infrastructure and works across serverless instances.
 *
 * See docs/security.md ("Support form abuse protection").
 */

/** Sliding-window limits on accepted submissions. */
export const RATE_LIMITS = {
	perIp: { max: 5, windowMs: 60 * 60 * 1000 },
	perEmail: { max: 3, windowMs: 60 * 60 * 1000 },
} as const;

/**
 * Client IP as reported by the platform. On Vercel `x-forwarded-for` is set by
 * the proxy and its first entry is trustworthy; locally it's absent (or, in
 * E2E, injected by Playwright to isolate test runs from each other).
 */
export async function getClientIp(): Promise<string> {
	const h = await headers();
	const forwarded = h.get("x-forwarded-for");
	return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Salted SHA-256 of the client IP. We never store raw addresses — the hash is
 * enough to rate-limit, and the salt (the app's auth secret) prevents
 * rainbow-table reversal of the small IPv4 space.
 */
export function hashIp(ip: string, salt: string = env.BETTER_AUTH_SECRET): string {
	return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Verify a Cloudflare Turnstile token. No-op (returns true) until
 * TURNSTILE_SECRET_KEY is configured. Fails closed: a missing/invalid token or
 * an unreachable siteverify endpoint rejects the submission.
 */
export async function verifyTurnstileToken(
	token: string | undefined,
	remoteIp: string,
): Promise<boolean> {
	if (!env.TURNSTILE_SECRET_KEY) return true;
	if (!token) return false;
	try {
		const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
			method: "POST",
			body: new URLSearchParams({
				secret: env.TURNSTILE_SECRET_KEY,
				response: token,
				...(remoteIp !== "unknown" ? { remoteip: remoteIp } : {}),
			}),
		});
		const data = (await res.json()) as { success?: boolean };
		return data.success === true;
	} catch {
		return false;
	}
}

/**
 * True when this IP hash or email has hit its sliding-window limit. Counts
 * accepted (stored) submissions, so blocked attempts don't extend the window.
 */
export async function isRateLimited(ipHash: string, email: string): Promise<boolean> {
	const now = Date.now();
	const [byIp, byEmail] = await Promise.all([
		db
			.select({ n: count() })
			.from(supportRequest)
			.where(
				and(
					eq(supportRequest.ipHash, ipHash),
					gte(supportRequest.createdAt, new Date(now - RATE_LIMITS.perIp.windowMs)),
				),
			),
		db
			.select({ n: count() })
			.from(supportRequest)
			.where(
				and(
					eq(supportRequest.email, email),
					gte(supportRequest.createdAt, new Date(now - RATE_LIMITS.perEmail.windowMs)),
				),
			),
	]);
	return (
		(byIp[0]?.n ?? 0) >= RATE_LIMITS.perIp.max || (byEmail[0]?.n ?? 0) >= RATE_LIMITS.perEmail.max
	);
}
