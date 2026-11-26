import { meResponseSchema } from "@app/shared/api";
import { withApiSession } from "@/lib/auth/api-session";

/** The signed-in user. Contract: `ME_PATH` / `meResponseSchema` in @app/shared/api. */
export const GET = withApiSession((_request, { user }) =>
	// Parsing strips every field the contract doesn't name.
	Response.json(meResponseSchema.parse({ user })),
);
