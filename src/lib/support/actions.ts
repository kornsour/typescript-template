"use server";

import { legalConfig } from "@/content/legal/config";
import { db } from "@/db";
import { supportRequest } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { actionClient } from "@/lib/safe-action";
import { getClientIp, hashIp, isRateLimited, verifyTurnstileToken } from "./anti-spam";
import { supportSchema } from "./schema";

type SupportResult = { ok: true } | { ok: false; error: string };

/**
 * Deliver a support request to the app's support inbox
 * (`legalConfig.supportEmail`). Public — anyone can reach support, signed in or
 * not — so it's defended in layers (see src/lib/support/anti-spam.ts):
 * honeypot, optional Turnstile, and DB-backed rate limiting. Accepted requests
 * are stored in `support_request` (audit trail + the rate limiter's data),
 * then emailed with the sender's address as reply-to so support can respond
 * directly. Uses the pluggable email sender (console in dev, SES in prod).
 *
 * Soft failures return `{ ok: false, error }` instead of throwing, so the form
 * can show a friendly message without next-safe-action masking it.
 */
export const submitSupportRequest = actionClient
	.schema(supportSchema)
	.action(async ({ parsedInput }): Promise<SupportResult> => {
		const { name, category, message, website, turnstileToken } = parsedInput;
		// Normalize so the per-email rate limit can't be dodged by case games.
		const email = parsedInput.email.toLowerCase();

		// 1. Honeypot: hidden field a human never fills. Pretend success so the
		//    bot learns nothing; store and send nothing.
		if (website) return { ok: true };

		const ip = await getClientIp();

		// 2. Turnstile (only when configured — free, see docs/setup/turnstile.md).
		if (!(await verifyTurnstileToken(turnstileToken, ip))) {
			return { ok: false, error: "Verification failed — please try again." };
		}

		// 3. Sliding-window rate limit, counted against stored submissions.
		const ipHash = hashIp(ip);
		if (await isRateLimited(ipHash, email)) {
			return { ok: false, error: "Too many messages — please try again later." };
		}

		await db.insert(supportRequest).values({ name, email, category, message, ipHash });

		await sendEmail({
			to: legalConfig.supportEmail,
			replyTo: email,
			subject: `[Support · ${category}] from ${name}`,
			text: `${message}\n\n—\nFrom: ${name} <${email}>\nCategory: ${category}`,
		});
		return { ok: true };
	});
