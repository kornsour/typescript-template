import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";
import { isLambdaRuntime, isNeonUrl, serverlessDriverError } from "./driver";
import * as schema from "./schema";

/**
 * Selects the Drizzle driver from the connection string:
 *   - Neon hosts (`*.neon.tech`) use the serverless HTTP driver.
 *   - Everything else (local Homebrew Postgres) uses node-postgres over TCP.
 *
 * This is what lets the same code run against a local Postgres in development
 * and Neon in preview/production — you only change `DATABASE_URL`.
 * See docs/adr/0011-local-postgres-neon-dual-driver.md.
 *
 * On the AWS target the TCP path is not merely discouraged, it is refused: a
 * `pg` pool inside Lambda opens a connection per concurrent invocation and
 * exhausts Neon's limit. The rules live in ./driver.ts (and are unit-tested);
 * this module just enforces them at import time so a misconfigured deploy fails
 * at boot rather than under load. See ADR-0023.
 *
 * Both drivers expose the same Drizzle query API, so the export is typed as a
 * single concrete database type to keep call sites cleanly typed (the two
 * driver types don't unify cleanly across overloads like `.returning(...)`).
 */
const driverError = serverlessDriverError({
	databaseUrl: env.DATABASE_URL,
	isLambda: isLambdaRuntime(process.env),
});
if (driverError) throw new Error(driverError);

const isNeon = isNeonUrl(env.DATABASE_URL);

export const db = (isNeon
	? drizzleNeon({ client: neon(env.DATABASE_URL), schema })
	: drizzlePg({
			client: new Pool({ connectionString: env.DATABASE_URL }),
			schema,
		})) as unknown as NodePgDatabase<typeof schema>;
