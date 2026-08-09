import { describe, expect, it } from "vitest";
import { driverFor, isLambdaRuntime, isNeonUrl, serverlessDriverError } from "./driver";

const NEON = "postgresql://u:p@ep-cool-cell-123.us-east-1.aws.neon.tech/neondb?sslmode=require";
const LOCAL = "postgresql://andrew@localhost:5432/slalom_fitness_dev";

describe("driverFor", () => {
	it("uses the Neon HTTP driver for Neon hosts", () => {
		expect(isNeonUrl(NEON)).toBe(true);
		expect(driverFor(NEON)).toBe("neon-http");
	});

	it("uses node-postgres for anything else", () => {
		expect(isNeonUrl(LOCAL)).toBe(false);
		expect(driverFor(LOCAL)).toBe("node-postgres");
	});
});

describe("isLambdaRuntime", () => {
	it("keys on the variable AWS sets and nothing else does", () => {
		expect(isLambdaRuntime({ AWS_LAMBDA_FUNCTION_NAME: "slalom-server" })).toBe(true);
		expect(isLambdaRuntime({ NODE_ENV: "production" })).toBe(false);
		expect(isLambdaRuntime({})).toBe(false);
	});
});

describe("serverlessDriverError", () => {
	it("refuses a TCP pool inside Lambda", () => {
		expect(serverlessDriverError({ databaseUrl: LOCAL, isLambda: true })).toMatch(/neon\.tech/);
	});

	it("allows Neon inside Lambda", () => {
		expect(serverlessDriverError({ databaseUrl: NEON, isLambda: true })).toBeNull();
	});

	it("leaves local development alone", () => {
		// `pnpm dev`, `pnpm build`, the render smoke and the E2E specs all run
		// against a local Postgres over TCP, and must keep working.
		expect(serverlessDriverError({ databaseUrl: LOCAL, isLambda: false })).toBeNull();
	});
});
