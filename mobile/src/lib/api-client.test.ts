import { describe, expect, it, vi } from "vitest";
import { type ApiDeps, ApiError, type Fetcher, fetchMe, REQUEST_TIMEOUT_MS } from "./api-client";

const me = { user: { id: "u1", name: "Ada", email: "ada@example.com", emailVerified: true } };

function deps(fetchImpl: Fetcher, cookie = "better-auth.session_token=abc"): ApiDeps {
	return { baseUrl: "http://api.test", getCookie: async () => cookie, fetch: fetchImpl };
}

function respond(status: number, body: unknown) {
	return vi.fn<Fetcher>(async () => new Response(JSON.stringify(body), { status }));
}

describe("fetchMe", () => {
	it("sends the session cookie and returns the parsed user", async () => {
		const fetchImpl = respond(200, me);
		await expect(fetchMe(deps(fetchImpl))).resolves.toEqual(me);

		const [url, init] = fetchImpl.mock.calls[0] ?? [];
		expect(url).toBe("http://api.test/api/me");
		expect(init?.credentials).toBe("omit");
		expect(new Headers(init?.headers).get("cookie")).toBe("better-auth.session_token=abc");
	});

	it("omits the cookie header when there is none", async () => {
		const fetchImpl = respond(200, me);
		await fetchMe(deps(fetchImpl, ""));
		expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).has("cookie")).toBe(false);
	});

	it("reports 401 with its status", async () => {
		const promise = fetchMe(deps(respond(401, { error: "Unauthorized" })));
		await expect(promise).rejects.toBeInstanceOf(ApiError);
		await expect(promise).rejects.toMatchObject({ status: 401 });
	});

	it("reports other HTTP errors", async () => {
		await expect(fetchMe(deps(respond(500, {})))).rejects.toMatchObject({
			status: 500,
			message: "The server returned an error (500).",
		});
	});

	it("rejects a response that breaks the contract", async () => {
		await expect(fetchMe(deps(respond(200, { user: { id: 1 } })))).rejects.toThrow(/unexpected/);
		const html = vi.fn<Fetcher>(async () => new Response("<html>", { status: 200 }));
		await expect(fetchMe(deps(html))).rejects.toThrow(/unexpected/);
	});

	it("turns network failures into a readable error", async () => {
		const offline = vi.fn<Fetcher>(async () => {
			throw new TypeError("Network request failed");
		});
		await expect(fetchMe(deps(offline))).rejects.toMatchObject({
			status: undefined,
			message: expect.stringContaining("Couldn't reach the server"),
		});
	});

	it("aborts a request that takes too long", async () => {
		vi.useFakeTimers();
		try {
			const hang = vi.fn<Fetcher>(
				(_url, init) =>
					new Promise((_resolve, reject) => {
						init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
					}),
			);
			const assertion = expect(fetchMe(deps(hang))).rejects.toThrow(/Couldn't reach/);
			await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
			await assertion;
		} finally {
			vi.useRealTimers();
		}
	});
});
