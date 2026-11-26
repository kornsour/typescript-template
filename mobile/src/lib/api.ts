import { type ApiDeps, fetchMe } from "./api-client";
import { authClient } from "./auth-client";
import { API_URL } from "./config";

const deps: ApiDeps = {
	baseUrl: API_URL,
	getCookie: () => authClient.getCookie(),
};

/** API calls bound to this app's server and session. Add new endpoints here. */
export const api = {
	me: (signal?: AbortSignal) => fetchMe(deps, signal),
};
