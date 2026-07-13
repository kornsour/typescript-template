"use server";

import { legalConfig } from "@/content/legal/config";
import { sendEmail } from "@/lib/email";
import { actionClient } from "@/lib/safe-action";
import { supportSchema } from "./schema";

/**
 * Deliver a support request to the app's support inbox
 * (`legalConfig.supportEmail`). Public — anyone can reach support, signed in or
 * not. The sender's address is set as reply-to so support can respond directly.
 * Uses the pluggable email sender (console in dev, SES in prod).
 */
export const submitSupportRequest = actionClient
	.schema(supportSchema)
	.action(async ({ parsedInput }) => {
		const { name, email, category, message } = parsedInput;
		await sendEmail({
			to: legalConfig.supportEmail,
			replyTo: email,
			subject: `[Support · ${category}] from ${name}`,
			text: `${message}\n\n—\nFrom: ${name} <${email}>\nCategory: ${category}`,
		});
		return { ok: true };
	});
