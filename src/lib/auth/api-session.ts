import { auth, type Session } from "@/lib/auth";

/**
 * Session gate for JSON API routes, the counterpart of `requireUser()` (which
 * redirects, so it only suits pages and server actions). Answers 401 without a
 * valid session and marks every response as uncacheable, since it is per user.
 *
 * The session comes from the request's Cookie header, which both browsers and
 * the mobile app send.
 *
 * Use it for reads. better-auth's CSRF protection covers only /api/auth/*, so a
 * route that changes state must also verify the request's origin itself.
 *
 *   export const GET = withApiSession((_request, { user }) => Response.json(…));
 */
export function withApiSession<Args extends unknown[]>(
	handler: (request: Request, session: Session, ...args: Args) => Response | Promise<Response>,
) {
	return async (request: Request, ...args: Args): Promise<Response> => {
		const session = await auth.api.getSession({
			headers: request.headers,
			// Leave expiry refresh to /api/auth/get-session, where the client stores
			// the renewed cookie. The mobile app ignores Set-Cookie from other routes,
			// so refreshing here would leave its stored expiry stale.
			query: { disableRefresh: true },
		});
		const response = session
			? await handler(request, session, ...args)
			: Response.json({ error: "Unauthorized" }, { status: 401 });
		// Copied because some responses (redirects, passed-through `fetch` results)
		// have immutable headers.
		const headers = new Headers(response.headers);
		headers.set("Cache-Control", "private, no-store");
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	};
}
