import { ME_PATH, type MeResponse, meResponseSchema } from "@app/shared/api";
import type { z } from "zod/v4";

export const REQUEST_TIMEOUT_MS = 15_000;

/** A failed API call, with a message that is safe to show the user. */
export class ApiError extends Error {
	/** HTTP status; undefined when no response arrived. */
	readonly status: number | undefined;

	constructor(message: string, status?: number) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

/**
 * The part of `fetch` this client uses. Narrower than `typeof fetch`, whose
 * overloads differ between the React Native, DOM and Node type definitions.
 */
export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export interface ApiDeps {
	baseUrl: string;
	/** The session cookie header value, "" when signed out. */
	getCookie: () => string | Promise<string>;
	fetch?: Fetcher;
}

/** Authenticated GET whose response is validated against a shared schema. */
export async function apiGet<T>(
	deps: ApiDeps,
	path: string,
	schema: z.ZodType<T>,
	signal?: AbortSignal,
): Promise<T> {
	const cookie = await deps.getCookie();
	const controller = new AbortController();
	const abort = () => controller.abort();
	if (signal?.aborted) abort();
	signal?.addEventListener("abort", abort);
	const timeout = setTimeout(abort, REQUEST_TIMEOUT_MS);

	try {
		let response: Response;
		try {
			response = await (deps.fetch ?? fetch)(`${deps.baseUrl}${path}`, {
				headers: cookie ? { accept: "application/json", cookie } : { accept: "application/json" },
				// The cookie is set explicitly above; keep the native cookie jar out of it.
				credentials: "omit",
				signal: controller.signal,
			});
		} catch {
			throw new ApiError("Couldn't reach the server. Check your connection and try again.");
		}

		if (response.status === 401) {
			throw new ApiError("Your session has expired. Please sign in again.", 401);
		}
		if (!response.ok) {
			throw new ApiError(`The server returned an error (${response.status}).`, response.status);
		}

		const body: unknown = await response.json().catch(() => undefined);
		const parsed = schema.safeParse(body);
		if (!parsed.success) {
			throw new ApiError("The server sent an unexpected response.", response.status);
		}
		return parsed.data;
	} finally {
		clearTimeout(timeout);
		signal?.removeEventListener("abort", abort);
	}
}

export function fetchMe(deps: ApiDeps, signal?: AbortSignal): Promise<MeResponse> {
	return apiGet(deps, ME_PATH, meResponseSchema, signal);
}
