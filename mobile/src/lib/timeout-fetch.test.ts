import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { timeoutFetch } from "./timeout-fetch";

/** A server that never answers; settles only when the request is aborted. */
const hang: typeof fetch = (_input, init) =>
	new Promise((_resolve, reject) => {
		const fail = () => reject(new Error("aborted"));
		if (init?.signal?.aborted) fail();
		init?.signal?.addEventListener("abort", fail);
	});

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe("timeoutFetch", () => {
	it("times out even when the caller passes its own signal", async () => {
		const signal = new AbortController().signal;
		const assertion = expect(timeoutFetch(1000, hang)("http://x", { signal })).rejects.toThrow(
			"aborted",
		);
		await vi.advanceTimersByTimeAsync(1000);
		await assertion;
	});

	it("forwards the caller's abort", async () => {
		const caller = new AbortController();
		const assertion = expect(
			timeoutFetch(1000, hang)("http://x", { signal: caller.signal }),
		).rejects.toThrow("aborted");
		caller.abort();
		await assertion;
	});

	it("returns the response when the server answers in time", async () => {
		const ok: typeof fetch = async () => new Response("ok");
		await expect((await timeoutFetch(1000, ok)("http://x")).text()).resolves.toBe("ok");
	});
});
