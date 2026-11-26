/**
 * `fetch` that gives up after `timeoutMs`, while still honouring the caller's
 * own abort signal.
 *
 * The auth client needs this: its `timeout` option is ignored for requests that
 * bring a signal, which includes the session check that blocks app startup.
 */
export function timeoutFetch(timeoutMs: number, fetchImpl?: typeof fetch) {
	return async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
		const controller = new AbortController();
		const abort = () => controller.abort();
		const outer = init?.signal;
		if (outer?.aborted) abort();
		outer?.addEventListener("abort", abort);
		// Left running after the response arrives so a stalled body is cut off
		// too; aborting a finished request does nothing.
		const timer = setTimeout(abort, timeoutMs);
		try {
			return await (fetchImpl ?? fetch)(input, { ...init, signal: controller.signal });
		} catch (error) {
			clearTimeout(timer);
			throw error;
		}
	};
}
