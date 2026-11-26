/** The shape of `result.error` from the better-auth client. */
export interface AuthError {
	code?: string | undefined;
	message?: string | undefined;
	status?: number | undefined;
}

export const NETWORK_ERROR_MESSAGE =
	"Couldn't reach the server. Check your connection and try again.";

/** Production rejects sign-in until the address is verified (and emails a new link). */
export function isEmailNotVerified(error: AuthError): boolean {
	return error.code === "EMAIL_NOT_VERIFIED";
}

export function authErrorMessage(error: AuthError): string {
	if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
	return error.message || "Something went wrong. Please try again.";
}
