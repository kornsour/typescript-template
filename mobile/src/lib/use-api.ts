import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./api-client";

export type ApiState<T> =
	| { status: "loading" }
	| { status: "success"; data: T }
	| { status: "error"; error: ApiError };

/**
 * Runs an API call on mount and on `reload()`. Pass a stable function (e.g.
 * `api.me`, or one wrapped in `useCallback`), or it refetches on every render.
 */
export function useApi<T>(load: (signal: AbortSignal) => Promise<T>) {
	const [state, setState] = useState<ApiState<T>>({ status: "loading" });
	const [attempt, setAttempt] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the request
	useEffect(() => {
		const controller = new AbortController();
		setState({ status: "loading" });
		load(controller.signal).then(
			(data) => {
				if (!controller.signal.aborted) setState({ status: "success", data });
			},
			(cause: unknown) => {
				if (controller.signal.aborted) return;
				const error =
					cause instanceof ApiError ? cause : new ApiError("Something went wrong. Try again.");
				setState({ status: "error", error });
			},
		);
		return () => controller.abort();
	}, [load, attempt]);

	const reload = useCallback(() => setAttempt((n) => n + 1), []);
	return { state, reload };
}
