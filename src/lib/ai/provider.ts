import { createRequire } from "node:module";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import {
	APICallError,
	generateObject,
	generateText,
	type LanguageModel,
	LoadAPIKeyError,
} from "ai";
import type { z } from "zod/v4";
import { env } from "@/env";
import { assertAiDeploymentBoundary, assertSubscriptionModelAllowed } from "./deployment-boundary";
import { modelName, modelTier } from "./model-id";

/* -------------------------------------------------------------------------- */
/*  AI model access — frontier APIs for deployment, subscription CLIs for      */
/*  local development, behind one "<tier>/<model>" string id.                  */
/*  See src/lib/ai/model-id.ts for the id convention and ADR-0022 for the      */
/*  local-vs-deployed rules. The whole layer is inert until AI_MODEL is set.   */
/* -------------------------------------------------------------------------- */

// Import-time boundary: a deployed build with a subscription model configured,
// or a production deploy missing the API key its model needs, fails at boot
// instead of on the first user request. No-op outside Vercel environments.
assertAiDeploymentBoundary({
	vercelEnv: env.VERCEL_ENV,
	configuredModelIds: [env.AI_MODEL, env.AI_MODEL_FALLBACK].filter((id): id is string =>
		Boolean(id),
	),
	hasAnthropicKey: Boolean(env.ANTHROPIC_API_KEY),
	hasOpenAiKey: Boolean(env.OPENAI_API_KEY),
});

/** Cheap boolean guard for UI / route code to check before offering AI features. */
export const isAiEnabled = Boolean(env.AI_MODEL);

/**
 * Settings baked into the Claude subscription tier. Routing through Claude
 * Code carries a large per-call input-token floor; loading the operator's
 * environment (MCP servers, CLAUDE.md, full tool set) roughly doubles it. We
 * strip all of it — this is a headless structured-output call, not an
 * interactive coding session. maxTurns is a ceiling, not a per-call cost:
 * with tools/MCP stripped there is no agentic loop to run away, it only
 * bounds how long a structured-output call may take.
 */
const CLAUDE_CODE_SETTINGS: import("ai-sdk-provider-claude-code").ClaudeCodeSettings = {
	settingSources: [],
	allowedTools: [],
	mcpServers: {},
	maxTurns: 8,
	systemPrompt: "You extract structured data. Respond only with the requested structured output.",
};

export async function resolveModel(modelId: string): Promise<LanguageModel> {
	const tier = modelTier(modelId);
	const name = modelName(modelId);

	switch (tier) {
		case "anthropic": {
			if (!env.ANTHROPIC_API_KEY) {
				throw new Error(`Model "${modelId}" needs ANTHROPIC_API_KEY to be set.`);
			}
			return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(name);
		}
		case "openai": {
			if (!env.OPENAI_API_KEY) {
				throw new Error(`Model "${modelId}" needs OPENAI_API_KEY to be set.`);
			}
			return createOpenAI({ apiKey: env.OPENAI_API_KEY })(name);
		}
		case "claude-code": {
			assertSubscriptionModelAllowed(modelId, {
				nodeEnv: env.NODE_ENV,
				vercelEnv: env.VERCEL_ENV,
			});
			// Lazy CJS require so the community adapter (and the Claude Agent SDK it
			// pulls in) is never bundled into the production build — it only loads on
			// the local subscription path. Do NOT convert this to a top-level import.
			const require = createRequire(import.meta.url);
			const { createClaudeCode } =
				require("ai-sdk-provider-claude-code") as typeof import("ai-sdk-provider-claude-code");
			const claudeCode = createClaudeCode({ defaultSettings: CLAUDE_CODE_SETTINGS });
			return claudeCode(name) as LanguageModel;
		}
		case "codex": {
			assertSubscriptionModelAllowed(modelId, {
				nodeEnv: env.NODE_ENV,
				vercelEnv: env.VERCEL_ENV,
			});
			// Same lazy-loading rationale as claude-code above — but this adapter is
			// ESM-only (no "require" export condition), so it needs a dynamic
			// import(). serverExternalPackages in next.config.ts keeps it out of the
			// bundle. Requires the `codex` CLI installed and logged in (`codex
			// login`). Read-only sandbox: these are headless generation calls, the
			// CLI must not touch the workspace.
			const { codexExec } = await import("ai-sdk-provider-codex-cli");
			return codexExec(name, { skipGitRepoCheck: true, sandboxMode: "read-only" }) as LanguageModel;
		}
		default:
			throw new Error(
				`Unknown model id "${modelId}" — expected "<tier>/<model>" with tier one of ` +
					`"anthropic", "openai", "claude-code", "codex". See src/lib/ai/model-id.ts.`,
			);
	}
}

/**
 * True for errors that mean "this model can't serve the call right now" —
 * missing key, auth rejected, or quota/allowance exhausted — as opposed to a
 * transient or schema error. Drives the fallback in runWithFallback().
 * Heuristic on status code + message because the subscription-quota error
 * shape isn't a stable, documented type.
 */
export function isModelUnavailableError(err: unknown): boolean {
	if (LoadAPIKeyError.isInstance(err)) return true;
	if (APICallError.isInstance(err)) {
		const status = err.statusCode;
		if (status === 401 || status === 403 || status === 429) return true;
	}
	const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
	return /quota|rate.?limit|usage limit|allowance|insufficient|credit|unauthor|authentication|forbidden|exhaust/.test(
		message,
	);
}

/**
 * Run a model call with automatic fallback. Runs `call` on the primary id; if
 * that hits an auth/quota error (see isModelUnavailableError) and
 * AI_MODEL_FALLBACK is a *different* id, retries once on the fallback. This is
 * what lets local dev ride a subscription until its allowance runs out, then
 * overflow onto a metered API key. Returns the id that actually served the
 * call so callers can record it.
 */
async function runWithFallback<T>(
	call: (modelId: string) => Promise<T>,
	modelId?: string,
): Promise<{ result: T; servedBy: string }> {
	const primaryId = modelId ?? env.AI_MODEL;
	if (!primaryId) {
		throw new Error("AI is not configured — set AI_MODEL to enable model calls. See ADR-0022.");
	}
	try {
		return { result: await call(primaryId), servedBy: primaryId };
	} catch (err) {
		const fallbackId = env.AI_MODEL_FALLBACK;
		if (fallbackId && fallbackId !== primaryId && isModelUnavailableError(err)) {
			console.warn(
				`[ai] model "${primaryId}" unavailable (${err instanceof Error ? err.message : err}); ` +
					`falling back to "${fallbackId}".`,
			);
			return { result: await call(fallbackId), servedBy: fallbackId };
		}
		throw err;
	}
}

/** Structured-output generation with automatic fallback. */
export async function runObject<OBJECT>(opts: {
	schema: z.ZodType<OBJECT>;
	prompt: string;
	system?: string;
	model?: string;
	schemaName?: string;
	schemaDescription?: string;
}): Promise<{ object: OBJECT; servedBy: string }> {
	const { result, servedBy } = await runWithFallback(async (modelId) => {
		const { object } = await generateObject({
			model: await resolveModel(modelId),
			schema: opts.schema,
			prompt: opts.prompt,
			system: opts.system,
			schemaName: opts.schemaName,
			schemaDescription: opts.schemaDescription,
		});
		return object;
	}, opts.model);
	return { object: result, servedBy };
}

/** Free-text generation with automatic fallback. */
export async function runText(opts: {
	prompt: string;
	system?: string;
	model?: string;
}): Promise<{ text: string; servedBy: string }> {
	const { result, servedBy } = await runWithFallback(async (modelId) => {
		const { text } = await generateText({
			model: await resolveModel(modelId),
			prompt: opts.prompt,
			system: opts.system,
		});
		return text;
	}, opts.model);
	return { text: result, servedBy };
}
