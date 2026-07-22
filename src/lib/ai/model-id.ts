/**
 * Model ids are "<tier>/<model>" strings — e.g. "anthropic/claude-opus-4-8",
 * "openai/gpt-5.6-terra", "claude-code/opus", "codex/gpt-5.5". The tier decides
 * how the call authenticates, and therefore where it is allowed to run:
 *
 *   "anthropic/<model>"   → Anthropic Messages API via ANTHROPIC_API_KEY (deployable)
 *   "openai/<model>"      → OpenAI API via OPENAI_API_KEY (deployable)
 *   "claude-code/<model>" → the logged-in `claude` CLI (Claude Pro/Max
 *                           subscription) — LOCAL DEVELOPMENT ONLY
 *   "codex/<model>"       → the logged-in `codex` CLI (ChatGPT Plus/Pro
 *                           subscription) — LOCAL DEVELOPMENT ONLY
 *
 * See docs/adr/0022-ai-model-access-tiers.md for why subscription tiers are
 * fenced out of deployed builds (Anthropic/OpenAI terms of use).
 */

export const API_TIERS = ["anthropic", "openai"] as const;
export const SUBSCRIPTION_TIERS = ["claude-code", "codex"] as const;

export type ApiTier = (typeof API_TIERS)[number];
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];
export type AiTier = ApiTier | SubscriptionTier;

const ALL_TIERS: readonly string[] = [...API_TIERS, ...SUBSCRIPTION_TIERS];

/** The tier prefix of a model id, or null if the id has no known tier. */
export function modelTier(modelId: string): AiTier | null {
	const slash = modelId.indexOf("/");
	if (slash <= 0) return null;
	const tier = modelId.slice(0, slash);
	return ALL_TIERS.includes(tier) ? (tier as AiTier) : null;
}

/** The provider-facing model name (the part after the tier prefix). */
export function modelName(modelId: string): string {
	return modelId.slice(modelId.indexOf("/") + 1);
}

/** True when the id rides a personal subscription login instead of an API key. */
export function isSubscriptionModel(modelId: string): boolean {
	const tier = modelTier(modelId);
	return tier !== null && (SUBSCRIPTION_TIERS as readonly string[]).includes(tier);
}
