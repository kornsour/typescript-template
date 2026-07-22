import { describe, expect, it } from "vitest";
import { isSubscriptionModel, modelName, modelTier } from "./model-id";

describe("modelTier", () => {
	it("recognizes the API tiers", () => {
		expect(modelTier("anthropic/claude-opus-4-8")).toBe("anthropic");
		expect(modelTier("openai/gpt-5.6-terra")).toBe("openai");
	});

	it("recognizes the subscription tiers", () => {
		expect(modelTier("claude-code/opus")).toBe("claude-code");
		expect(modelTier("codex/gpt-5.5")).toBe("codex");
	});

	it("returns null for unknown or malformed ids", () => {
		expect(modelTier("gemini/pro")).toBeNull();
		expect(modelTier("claude-opus-4-8")).toBeNull();
		expect(modelTier("/model")).toBeNull();
		expect(modelTier("")).toBeNull();
	});
});

describe("modelName", () => {
	it("strips the tier prefix", () => {
		expect(modelName("anthropic/claude-opus-4-8")).toBe("claude-opus-4-8");
		expect(modelName("codex/gpt-5.5")).toBe("gpt-5.5");
	});

	it("keeps slashes inside the model name", () => {
		expect(modelName("openai/org/custom-model")).toBe("org/custom-model");
	});
});

describe("isSubscriptionModel", () => {
	it("is true only for subscription tiers", () => {
		expect(isSubscriptionModel("claude-code/sonnet")).toBe(true);
		expect(isSubscriptionModel("codex/gpt-5.5")).toBe(true);
		expect(isSubscriptionModel("anthropic/claude-opus-4-8")).toBe(false);
		expect(isSubscriptionModel("openai/gpt-5.6-terra")).toBe(false);
		expect(isSubscriptionModel("not-a-model-id")).toBe(false);
	});
});
