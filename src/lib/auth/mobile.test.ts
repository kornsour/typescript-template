import { APP_SCHEME } from "@app/shared/app";
import { betterAuth } from "better-auth";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({ NODE_ENV: "test" }));
vi.mock("@/env", () => ({ env: mockEnv }));

/** Load ./mobile as it would evaluate in the given environment. */
async function load(nodeEnv: string) {
	mockEnv.NODE_ENV = nodeEnv;
	vi.resetModules();
	return import("./mobile");
}

describe("mobileTrustedOrigins", () => {
	it("trusts only the app scheme in production", async () => {
		const { mobileTrustedOrigins } = await load("production");
		expect(mobileTrustedOrigins).toEqual([`${APP_SCHEME}://`]);
	});

	it("trusts only the app scheme under test", async () => {
		const { mobileTrustedOrigins } = await load("test");
		expect(mobileTrustedOrigins).toEqual([`${APP_SCHEME}://`]);
	});

	it("additionally trusts Expo Go in development", async () => {
		const { mobileTrustedOrigins } = await load("development");
		expect(mobileTrustedOrigins).toEqual([`${APP_SCHEME}://`, "exp://"]);
	});
});

describe("auth server origin matching in production", () => {
	async function context() {
		const { mobilePlugins, mobileTrustedOrigins } = await load("production");
		const auth = betterAuth({
			baseURL: "https://app.example.com",
			// Built rather than written out, so secret scanners don't flag it.
			secret: "x".repeat(32),
			trustedOrigins: mobileTrustedOrigins,
			plugins: [...mobilePlugins],
		});
		const ctx = await auth.$context;
		// Includes what plugins contribute during init, as a real request would.
		expect(ctx.options.trustedOrigins).toEqual([`${APP_SCHEME}://`]);
		return ctx;
	}

	it("accepts the web origin and app deep links", async () => {
		const ctx = await context();
		expect(ctx.isTrustedOrigin("https://app.example.com")).toBe(true);
		expect(ctx.isTrustedOrigin(`${APP_SCHEME}://dashboard`)).toBe(true);
	});

	it.each([
		"https://evil.example.com",
		`https://evil.example.com/${APP_SCHEME}://`,
		"//evil.example.com",
		`${APP_SCHEME}-evil://dashboard`,
		"exp://192.168.1.10:8081",
		"javascript:alert(1)",
	])("rejects %s", async (url) => {
		const ctx = await context();
		expect(ctx.isTrustedOrigin(url, { allowRelativePaths: true })).toBe(false);
	});
});

describe("expo-origin header", () => {
	async function originAfter(headers: Record<string, string>) {
		const { mobilePlugins } = await load("production");
		const request = new Request("https://app.example.com/api/auth/sign-in/email", {
			method: "POST",
			headers,
			body: "payload",
		});
		const result = await mobilePlugins[0].onRequest(request);
		const next = result?.request ?? request;
		expect(await next.text()).toBe("payload");
		return next.headers.get("origin");
	}

	it("stands in for a missing Origin", async () => {
		expect(await originAfter({ "expo-origin": `${APP_SCHEME}://` })).toBe(`${APP_SCHEME}://`);
	});

	it("handles the NextRequest the route handler actually receives", async () => {
		const { mobilePlugins } = await load("production");
		const request = new NextRequest("https://app.example.com/api/auth/sign-in/email", {
			method: "POST",
			headers: { "expo-origin": `${APP_SCHEME}://` },
			body: "payload",
		});
		const result = await mobilePlugins[0].onRequest(request);
		expect(result?.request.headers.get("origin")).toBe(`${APP_SCHEME}://`);
		expect(await result?.request.text()).toBe("payload");
	});

	it("copies the request when its headers are immutable", async () => {
		const { mobilePlugins } = await load("production");
		const request = new Request("https://app.example.com/", {
			headers: { "expo-origin": `${APP_SCHEME}://` },
		});
		vi.spyOn(request.headers, "set").mockImplementation(() => {
			throw new TypeError("immutable");
		});
		const result = await mobilePlugins[0].onRequest(request);
		expect(result?.request).not.toBe(request);
		expect(result?.request.headers.get("origin")).toBe(`${APP_SCHEME}://`);
	});

	it("never overrides a real Origin", async () => {
		const headers = { origin: "https://evil.example.com", "expo-origin": `${APP_SCHEME}://` };
		expect(await originAfter(headers)).toBe("https://evil.example.com");
	});

	it("leaves requests without either header alone", async () => {
		expect(await originAfter({})).toBeNull();
	});
});
