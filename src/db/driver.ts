/**
 * Which Drizzle driver a connection string gets, and where each one is allowed.
 *
 * Pure so it can be unit-tested without a database. See ADR-0011 for the
 * dual-driver decision and ADR-0023 for why Lambda is HTTP-only.
 */

export type DriverKind = "neon-http" | "node-postgres";

/** Neon's serverless HTTP endpoint, as opposed to any other Postgres host. */
export function isNeonUrl(databaseUrl: string): boolean {
	return /\.neon\.tech/.test(databaseUrl);
}

export function driverFor(databaseUrl: string): DriverKind {
	return isNeonUrl(databaseUrl) ? "neon-http" : "node-postgres";
}

/**
 * True when this process is a Lambda. AWS sets AWS_LAMBDA_FUNCTION_NAME in
 * every Lambda execution environment, and nothing else does — which makes it a
 * more honest signal than NODE_ENV, since a local `next start` is also
 * "production".
 */
export function isLambdaRuntime(envVars: Record<string, string | undefined>): boolean {
	return Boolean(envVars.AWS_LAMBDA_FUNCTION_NAME);
}

/**
 * Refuse a TCP `pg` pool inside Lambda.
 *
 * A pooled TCP client in a function that scales horizontally opens a connection
 * per concurrent invocation and holds it past the response, which exhausts
 * Neon's connection limit long before the app is under any real load. The HTTP
 * driver has no connection to leak. Failing at boot with this message is much
 * cheaper than diagnosing "too many connections" in production at 3am.
 *
 * Returns an error message, or null when the combination is fine.
 */
export function serverlessDriverError(input: {
	databaseUrl: string;
	isLambda: boolean;
}): string | null {
	if (!input.isLambda) return null;
	if (isNeonUrl(input.databaseUrl)) return null;
	return (
		"This build is running in Lambda with a non-Neon DATABASE_URL, which would open a TCP " +
		"connection pool per concurrent invocation. Point DATABASE_URL at a *.neon.tech host so " +
		"the serverless HTTP driver is used. See docs/adr/0023-aws-sst-deploy.md."
	);
}
