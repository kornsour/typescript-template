/**
 * Build-time database migrator for deploys.
 *
 * Replaces `drizzle-kit migrate` in the deploy path (scripts/db-deploy.sh),
 * which the CLI can't do well on a hosted build:
 *
 *   1. Real errors. drizzle-kit hides a connection failure behind its progress
 *      spinner as an opaque `exit code 1`; the actual cause (host, TLS, auth)
 *      is swallowed, so a first-deploy failure is a mystery. This prints the
 *      real error and exits non-zero — a one-line, actionable message.
 *
 *   2. TLS for managed Postgres. The node-postgres path needs an explicit `ssl`
 *      option for a hosted provider's cert chain; a URL-only config doesn't set
 *      one. We enable TLS for any non-local host.
 *
 * Uses Drizzle's node-postgres migrator over a `pg` Pool — the same driver the
 * app uses for non-Neon hosts (src/db/index.ts). Neon's pooled endpoint speaks
 * standard TLS with a publicly-trusted cert, so certificate verification stays
 * on by default. If a provider uses a private CA, either point `PGSSLROOTCERT`
 * at its bundle or set `DATABASE_SSL_NO_VERIFY=1` (verification off) for the
 * deploy.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
	const url = process.env.DATABASE_URL;
	if (!url) {
		console.error("db-migrate: DATABASE_URL is not set — cannot apply migrations.");
		process.exit(1);
	}

	// Local Postgres (localhost / 127.0.0.1 / ::1 / a unix socket) doesn't speak
	// TLS; every hosted provider requires it.
	const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) || url.includes("host=/");
	const ssl = isLocal
		? undefined
		: { rejectUnauthorized: process.env.DATABASE_SSL_NO_VERIFY !== "1" };

	const pool = new Pool({
		connectionString: url,
		ssl,
		// Fail fast with a clear error instead of hanging the build.
		connectionTimeoutMillis: 30_000,
	});

	try {
		await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
		console.log("✓ Migrations applied.");
	} catch (err) {
		const host = safeHost(url);
		console.error(`✗ Migration failed (database host: ${host}, tls: ${ssl ? "on" : "off"}).`);
		console.error(err instanceof Error ? (err.stack ?? err.message) : err);
		// Drizzle wraps the driver error; the underlying pg error (bad password,
		// TLS mismatch, unknown host) carries the actually-useful message.
		if (err instanceof Error && err.cause) {
			console.error("Cause:", err.cause);
		}
		process.exitCode = 1;
	} finally {
		await pool.end();
	}
}

/** Host:port of the connection string, for the error line — never the password. */
function safeHost(url: string): string {
	try {
		const u = new URL(url);
		return u.port ? `${u.hostname}:${u.port}` : u.hostname;
	} catch {
		return "unknown";
	}
}

main();
