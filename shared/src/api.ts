import { z } from "zod/v4";

/**
 * HTTP contract between the web backend and the mobile app. The route handler
 * builds responses that satisfy these schemas; the client parses with them.
 */
export const ME_PATH = "/api/me";

export const meResponseSchema = z.object({
	user: z.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		emailVerified: z.boolean(),
	}),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
