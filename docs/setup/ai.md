# AI model access

How to wire model access for AI/agentic features. Rationale and the
compliance rules live in [ADR-0022](../adr/0022-ai-model-access-tiers.md);
this is the setup guide.

The layer is **inert until `AI_MODEL` is set** — no keys, no login, no AI.
Everything funnels through `runText()` / `runObject()` in
`src/lib/ai/provider.ts`.

## Model ids

`AI_MODEL` / `AI_MODEL_FALLBACK` take `"<tier>/<model>"` strings:

| Id | Backed by | Needs | Deployable? |
| --- | --- | --- | --- |
| `anthropic/claude-opus-4-8` | Anthropic API | `ANTHROPIC_API_KEY` | ✅ |
| `openai/<model>` | OpenAI API | `OPENAI_API_KEY` | ✅ |
| `claude-code/opus` (or `sonnet`, `haiku`) | your `claude` CLI login (Claude Pro/Max) | `claude` installed + logged in | ❌ local dev only |
| `codex/gpt-5.5` | your `codex` CLI login (ChatGPT Plus/Pro) | `codex` installed + logged in (`codex login`) | ❌ local dev only |

## Local development (subscription — no API bill)

1. Have the CLI for your subscription installed and logged in:
   - Claude: the `claude` CLI (Claude Code), logged in with your Pro/Max account.
   - OpenAI: `npm i -g @openai/codex`, then `codex login` with your ChatGPT account.
2. In `.env`:

   ```bash
   AI_MODEL="claude-code/opus"              # or "codex/gpt-5.5"
   AI_MODEL_FALLBACK="anthropic/claude-opus-4-8"   # optional overflow (needs the key)
   ANTHROPIC_API_KEY="sk-ant-..."           # only if you set the fallback
   ```

3. `pnpm dev`. When the subscription allowance runs out mid-session, calls
   automatically retry once on `AI_MODEL_FALLBACK`; the returned `servedBy`
   tells you which model actually answered.

Subscription models only work under `next dev`. `pnpm build` + `next start`
(and every deployed build) run as production, where they throw by design.

## Deployment (API keys)

```bash
vercel env add AI_MODEL production          # e.g. anthropic/claude-opus-4-8
vercel env add ANTHROPIC_API_KEY production # or OPENAI_API_KEY for openai/* ids
```

Guard rails you'll hit if something is off:

- A `claude-code/*` or `codex/*` id in any Vercel env → build/boot fails
  ("forbidden in deployed environments").
- An `anthropic/*` / `openai/*` id in production without its key → boot fails
  naming the missing key.

## Using it in features

```ts
import { z } from "zod/v4";
import { isAiEnabled, runObject, runText } from "@/lib/ai/provider";

// Gate UI/routes the same way billing gates on isBillingEnabled.
if (!isAiEnabled) return null;

const { text, servedBy } = await runText({ prompt: "Summarize: …" });

const { object } = await runObject({
	schema: z.object({ sentiment: z.enum(["positive", "neutral", "negative"]) }),
	prompt: "Classify: …",
	schemaName: "sentiment",
});
```

Don't call `generateText`/`generateObject` from `ai` directly — the wrappers
are where model resolution, the local-only guard, and fallback live.

Shipping a user-facing AI feature? Also flip `NEXT_PUBLIC_AI_FEATURES_ENABLED`
and drop `<AiDisclosureNotice>` into its UI — see `docs/legal.md`.

## Notes & quirks

- **Claude Code floor:** each `claude-code/*` call carries a sizable
  input-token floor from the CLI harness. Fine for dev; it's one reason this
  tier is not a production path even setting terms aside.
- **Codex structured output:** the codex adapter's `generateObject` support
  disallows optional schema fields and strips format/regex validators. Keep
  schemas simple, or verify against an API tier before shipping.
- **E2E/CI:** leave `AI_MODEL` unset there. The layer stays inert; specs never
  burn subscription usage or tokens.
- **Never** put a subscription login (or its OAuth token) in Vercel, CI,
  containers, or the repo. See the hard rules in ADR-0022.
