import { describe, expect, it } from "vitest";
import {
	assertAiDeploymentBoundary,
	assertSubscriptionModelAllowed,
	resolveDeployedEnv,
} from "./deployment-boundary";

/**
 * These tests guard the terms-of-use boundary from ADR-0022: subscription
 * logins are local-development-only. Keep them; do not relax them.
 */

describe("assertSubscriptionModelAllowed", () => {
	const localDev = { nodeEnv: "development", vercelEnv: undefined };

	it("allows subscription models in local development", () => {
		expect(() => assertSubscriptionModelAllowed("claude-code/opus", localDev)).not.toThrow();
		expect(() => assertSubscriptionModelAllowed("codex/gpt-5.5", localDev)).not.toThrow();
	});

	it("throws outside development (deployed/packaged builds run as production)", () => {
		expect(() =>
			assertSubscriptionModelAllowed("claude-code/opus", {
				nodeEnv: "production",
				vercelEnv: undefined,
			}),
		).toThrow(/local-only/);
	});

	it("throws in any Vercel environment even if NODE_ENV claims development", () => {
		expect(() =>
			assertSubscriptionModelAllowed("codex/gpt-5.5", {
				nodeEnv: "development",
				vercelEnv: "preview",
			}),
		).toThrow(/local-only/);
	});
});

describe("assertAiDeploymentBoundary", () => {
	const keys = { hasAnthropicKey: false, hasOpenAiKey: false };

	it("is a no-op outside Vercel environments (local dev, local prod builds, CI)", () => {
		expect(() =>
			assertAiDeploymentBoundary({
				vercelEnv: undefined,
				configuredModelIds: ["claude-code/opus"],
				...keys,
			}),
		).not.toThrow();
	});

	it("rejects subscription models in every deployed environment", () => {
		for (const vercelEnv of ["preview", "production"]) {
			expect(() =>
				assertAiDeploymentBoundary({
					vercelEnv,
					configuredModelIds: ["anthropic/claude-opus-4-8", "codex/gpt-5.5"],
					hasAnthropicKey: true,
					hasOpenAiKey: true,
				}),
			).toThrow(/forbidden in deployed environments/);
		}
	});

	it("requires the matching API key in production", () => {
		expect(() =>
			assertAiDeploymentBoundary({
				vercelEnv: "production",
				configuredModelIds: ["anthropic/claude-opus-4-8"],
				...keys,
			}),
		).toThrow(/ANTHROPIC_API_KEY/);
		expect(() =>
			assertAiDeploymentBoundary({
				vercelEnv: "production",
				configuredModelIds: ["openai/gpt-5.6-terra"],
				...keys,
			}),
		).toThrow(/OPENAI_API_KEY/);
	});

	it("passes in production when the keys match the configured models", () => {
		expect(() =>
			assertAiDeploymentBoundary({
				vercelEnv: "production",
				configuredModelIds: ["anthropic/claude-opus-4-8", "openai/gpt-5.6-terra"],
				hasAnthropicKey: true,
				hasOpenAiKey: true,
			}),
		).not.toThrow();
	});

	it("does not require keys in preview for API-tier models", () => {
		expect(() =>
			assertAiDeploymentBoundary({
				vercelEnv: "preview",
				configuredModelIds: ["anthropic/claude-opus-4-8"],
				...keys,
			}),
		).not.toThrow();
	});

	it("passes when no models are configured (AI features off)", () => {
		expect(() =>
			assertAiDeploymentBoundary({
				vercelEnv: "production",
				configuredModelIds: [],
				...keys,
			}),
		).not.toThrow();
	});
});

/**
 * The AWS/SST target (ADR-0023) has no VERCEL_ENV. These tests pin the two
 * signals that replaced it, so moving off Vercel can't silently disarm the
 * guards above.
 */
describe("deployment signals beyond Vercel", () => {
	it("treats DEPLOY_ENV as a deployment for subscription models", () => {
		expect(() =>
			assertSubscriptionModelAllowed("claude-code/opus", {
				nodeEnv: "development",
				vercelEnv: undefined,
				deployEnv: "production",
			}),
		).toThrow(/local-only/);
	});

	it("treats a Lambda runtime as a deployment for subscription models", () => {
		expect(() =>
			assertSubscriptionModelAllowed("codex/gpt-5.5", {
				nodeEnv: "development",
				vercelEnv: undefined,
				isLambda: true,
			}),
		).toThrow(/local-only/);
	});

	it("still allows subscription models with no deployment signal at all", () => {
		expect(() =>
			assertSubscriptionModelAllowed("claude-code/opus", {
				nodeEnv: "development",
				vercelEnv: undefined,
				deployEnv: undefined,
				isLambda: false,
			}),
		).not.toThrow();
	});

	it("rejects a subscription model configured in an SST stage", () => {
		expect(() =>
			assertAiDeploymentBoundary({
				vercelEnv: undefined,
				deployEnv: "preview",
				configuredModelIds: ["claude-code/opus"],
				hasAnthropicKey: true,
				hasOpenAiKey: true,
			}),
		).toThrow(/forbidden in deployed environments/);
	});

	it("requires the API key in an SST production stage", () => {
		expect(() =>
			assertAiDeploymentBoundary({
				vercelEnv: undefined,
				deployEnv: "production",
				configuredModelIds: ["anthropic/claude-opus-4-8"],
				hasAnthropicKey: false,
				hasOpenAiKey: false,
			}),
		).toThrow(/ANTHROPIC_API_KEY/);
	});

	it("treats an unlabelled Lambda as production, the strictest case", () => {
		expect(resolveDeployedEnv({ vercelEnv: undefined, deployEnv: undefined, isLambda: true })).toBe(
			"production",
		);
		expect(resolveDeployedEnv({ vercelEnv: "preview", deployEnv: "production" })).toBe("preview");
		expect(resolveDeployedEnv({})).toBeUndefined();
	});
});
