import { isSubscriptionModel, modelTier } from "./model-id";

/**
 * The local-vs-deployed boundary for AI model access.
 *
 * Subscription tiers ("claude-code/*", "codex/*") authenticate with a personal
 * claude.ai / ChatGPT login. Both Anthropic's and OpenAI's consumer terms allow
 * that login for the account holder's own use — which covers a developer
 * testing on their own machine — but NOT serving other users from a deployed
 * app. Deployed builds must use metered API keys. These assertions make that
 * rule structural instead of documentation-only. Do not weaken them.
 * See docs/adr/0022-ai-model-access-tiers.md.
 */

export type AiRuntime = {
	nodeEnv: string;
	/** "development" | "preview" | "production" — set by Vercel, unset locally. */
	vercelEnv: string | undefined;
	/** The same signal for the AWS/SST target (env.DEPLOY_ENV). See ADR-0023. */
	deployEnv?: string | undefined;
	/** True inside a Lambda execution environment. See src/db/driver.ts. */
	isLambda?: boolean;
};

/**
 * "Is this build serving other people?" — one answer, three sources.
 *
 * VERCEL_ENV was the only signal when this app ran on Vercel. Moving to AWS
 * (ADR-0023) removed it, which would have silently disarmed every guard below,
 * so DEPLOY_ENV (set by sst.config.ts) and the Lambda runtime marker were added
 * alongside it. All three are checked; none replaces another.
 */
export function resolveDeployedEnv(input: {
	vercelEnv?: string | undefined;
	deployEnv?: string | undefined;
	isLambda?: boolean;
}): string | undefined {
	if (input.vercelEnv) return input.vercelEnv;
	if (input.deployEnv) return input.deployEnv;
	// A Lambda with no explicit stage is still a deployment; treat it as the
	// strictest case rather than the most permissive.
	return input.isLambda ? "production" : undefined;
}

/**
 * Call-time guard: a subscription model may only resolve during local `next
 * dev`. NODE_ENV is "development" only there — every deployed or packaged
 * build (including local `next start`) runs as "production". The vercelEnv
 * check is belt-and-suspenders for anything that overrides NODE_ENV.
 */
export function assertSubscriptionModelAllowed(modelId: string, runtime: AiRuntime): void {
	if (runtime.nodeEnv !== "development" || resolveDeployedEnv(runtime)) {
		throw new Error(
			`Model "${modelId}" uses a personal subscription login, which is local-only and ` +
				`cannot run in a deployed build. Set AI_MODEL to an "anthropic/*" or "openai/*" id ` +
				`with the matching API key for deployment. See ADR-0022.`,
		);
	}
}

export type AiBoundaryInput = {
	vercelEnv: string | undefined;
	/** The AWS/SST equivalent of vercelEnv (env.DEPLOY_ENV). See ADR-0023. */
	deployEnv?: string | undefined;
	/** True inside a Lambda execution environment. */
	isLambda?: boolean;
	/** Every configured model id (AI_MODEL, AI_MODEL_FALLBACK, …), unset ones omitted. */
	configuredModelIds: readonly string[];
	hasAnthropicKey: boolean;
	hasOpenAiKey: boolean;
};

/**
 * Import-time guard, run when the AI layer loads in a Vercel environment:
 *
 *  1. A subscription model id configured in ANY deployed environment is a
 *     misconfiguration (someone copied a local .env recipe into Vercel) — fail
 *     the build/boot instead of failing per-request.
 *  2. In production specifically, a configured API-tier model without its key
 *     is also a boot-time failure, so a missing key surfaces on deploy rather
 *     than on the first user request.
 *
 * Keyed on the deployment signals (not NODE_ENV) so local production builds —
 * `pnpm build`, `pnpm smoke` — still work without any AI configuration
 * gymnastics.
 */
export function assertAiDeploymentBoundary(input: AiBoundaryInput): void {
	const deployedEnv = resolveDeployedEnv(input);
	if (!deployedEnv) return;

	for (const id of input.configuredModelIds) {
		if (isSubscriptionModel(id)) {
			throw new Error(
				`AI model "${id}" is subscription-backed and forbidden in deployed environments. ` +
					`A personal Claude/ChatGPT login is not an application credential — use an ` +
					`"anthropic/*" or "openai/*" id with an API key. See ADR-0022.`,
			);
		}
	}

	if (deployedEnv !== "production") return;

	for (const id of input.configuredModelIds) {
		const tier = modelTier(id);
		if (tier === "anthropic" && !input.hasAnthropicKey) {
			throw new Error(
				`AI model "${id}" requires ANTHROPIC_API_KEY in the production environment. See ADR-0022.`,
			);
		}
		if (tier === "openai" && !input.hasOpenAiKey) {
			throw new Error(
				`AI model "${id}" requires OPENAI_API_KEY in the production environment. See ADR-0022.`,
			);
		}
	}
}
