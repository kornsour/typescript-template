/**
 * SecureStore keys may only contain letters, digits, ".", "-" and "_". URL
 * schemes also allow "+", so map anything else to "_".
 */
export function toStoragePrefix(scheme: string): string {
	return scheme.replace(/[^\w.-]/g, "_");
}
