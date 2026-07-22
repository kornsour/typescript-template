import { z } from "zod/v4";

/**
 * Support request shape, shared by the server action and the client form.
 * Kept out of the `"use server"` actions file: every export from a server-action
 * module must be an async action, so plain values/schemas live here instead.
 */

/** Support request categories shown in the form's dropdown. */
export const SUPPORT_CATEGORIES = ["Bug", "Question", "Feedback", "Other"] as const;

export const supportSchema = z.object({
	name: z.string().trim().min(1, "Enter your name.").max(100),
	email: z.email("Enter a valid email address."),
	category: z.enum(SUPPORT_CATEGORIES),
	message: z
		.string()
		.trim()
		.min(10, "Please add a few more details (at least 10 characters).")
		.max(5000),
	// Honeypot. Rendered invisibly on the form; humans never fill it, naive bots
	// do. Server-side, a non-empty value silently drops the message.
	website: z.string().max(200).optional(),
	// Cloudflare Turnstile token — only required (and verified) when
	// TURNSTILE_SECRET_KEY is configured. See src/lib/support/anti-spam.ts.
	turnstileToken: z.string().optional(),
});
