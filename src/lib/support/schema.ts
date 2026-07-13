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
});
