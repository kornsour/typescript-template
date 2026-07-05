import { env } from "@/env";

/**
 * Pluggable transactional email.
 *
 *   - No RESEND_API_KEY  → log the message (incl. any links) to the server
 *     console. This keeps email-verification and password-reset flows fully
 *     working in local development with zero setup.
 *   - RESEND_API_KEY set  → send for real via Resend's HTTP API (no SDK dep).
 *
 * Swap the `sendViaResend` body for SES/Postmark/etc. if you prefer another
 * provider — the rest of the app only depends on `sendEmail`.
 */

export type SendEmailInput = {
	to: string;
	subject: string;
	/** Plain-text body. `html` is optional and falls back to text. */
	text: string;
	html?: string;
};

const FROM = env.EMAIL_FROM ?? "noreply@example.com";

export async function sendEmail(input: SendEmailInput): Promise<void> {
	if (!env.RESEND_API_KEY) {
		console.info(
			`\n📧 [dev email — no RESEND_API_KEY set]\n  to:      ${input.to}\n  subject: ${input.subject}\n  ${input.text}\n`,
		);
		return;
	}
	await sendViaResend(input);
}

async function sendViaResend(input: SendEmailInput): Promise<void> {
	const res = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: FROM,
			to: input.to,
			subject: input.subject,
			text: input.text,
			html: input.html ?? input.text,
		}),
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Resend send failed (${res.status}): ${body}`);
	}
}
