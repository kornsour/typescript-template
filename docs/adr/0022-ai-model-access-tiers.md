# ADR-0022: AI model access — subscription CLIs for local dev, API keys for deployment

- Status: Accepted
- Date: 2026-07-22

## Context

Apps built from this template increasingly ship agentic/AI features. Two facts
shape how model access should be wired:

1. **Developers already pay for subscriptions.** A Claude Pro/Max plan (via the
   `claude` CLI) and a ChatGPT Plus/Pro plan (via the `codex` CLI) both include
   generous model allowances that are ideal for local development and testing —
   no per-token API bill while iterating.
2. **Provider terms draw a hard line at distribution.** Anthropic's and
   OpenAI's consumer terms permit a subscription login for the account
   holder's own use — which covers a developer testing on their own machine —
   but not powering a product that serves other people. A deployed app used by
   anyone other than the developer must authenticate with metered **API keys**
   (Anthropic API / OpenAI API), which are licensed for exactly that.

The template needs a pattern that makes the compliant path the easy path: free
subscription-backed iteration locally, API keys in deployment, and a structural
guarantee (not just documentation) that a subscription login can never end up
serving other users. This mirrors the setups proven in `career-manager`
(ADR-0021 there) and `sound-it-out` (ADR-0028 there).

## Decision

All model access goes through one string-id convention, `"<tier>/<model>"`,
resolved in `src/lib/ai/provider.ts` (Vercel AI SDK under the hood):

| Tier | Auth | Where allowed |
| --- | --- | --- |
| `anthropic/<model>` | `ANTHROPIC_API_KEY` (`@ai-sdk/anthropic`) | anywhere, incl. deployed |
| `openai/<model>` | `OPENAI_API_KEY` (`@ai-sdk/openai`) | anywhere, incl. deployed |
| `claude-code/<model>` | logged-in `claude` CLI (Claude Pro/Max), no key | **local `next dev` only** |
| `codex/<model>` | logged-in `codex` CLI (ChatGPT Plus/Pro), no key | **local `next dev` only** |

Configuration is `AI_MODEL` (primary) + `AI_MODEL_FALLBACK`; the layer is inert
until `AI_MODEL` is set (same gating philosophy as Stripe, ADR-0013). Features
call `runText()` / `runObject()` — never `generateText`/`generateObject`
directly — so every call funnels through the same resolution, guardrails, and
fallback.

**The local-only rule is enforced structurally, three ways:**

1. **Call-time guard** — `assertSubscriptionModelAllowed()` throws unless
   `NODE_ENV === "development"` *and* `VERCEL_ENV` is unset. Every deployed or
   packaged build (including local `next start`) runs as `production`, so a
   subscription id can only ever resolve during local `next dev`.
2. **Import-time boundary** — `assertAiDeploymentBoundary()` runs when the AI
   layer loads in any Vercel environment: a configured `claude-code/*` /
   `codex/*` id fails the boot outright (someone copied a local `.env` recipe
   into Vercel), and a production deploy whose configured model is missing its
   API key fails at boot instead of on the first user request. Keyed on
   `VERCEL_ENV` so local `pnpm build` / `pnpm smoke` need no AI config.
3. **Regression tests** — `src/lib/ai/deployment-boundary.test.ts` pins both
   guards. Keep those tests; do not relax them.

Additionally, the two community adapters (`ai-sdk-provider-claude-code`,
`ai-sdk-provider-codex-cli`, both pinned to exact versions) are **loaded
lazily inside their tier branches** — a `createRequire` for the claude-code
adapter, a dynamic `import()` for the ESM-only codex adapter — and both are
listed in `serverExternalPackages` (next.config.ts), so neither adapter — nor
the Claude Agent SDK the first one pulls in — is ever bundled into the
production build. Do not convert those to top-level imports.

**Fallback chain:** `runWithFallback()` retries once on `AI_MODEL_FALLBACK`
when the primary model hits an auth/quota error. The intended local recipe is
subscription-first with an API-key fallback — ride the paid-for allowance, and
overflow onto metered billing only when it's exhausted.

## Hard rules (for humans and agents editing this repo)

- Never weaken `assertSubscriptionModelAllowed()` or
  `assertAiDeploymentBoundary()`, and never default a `claude-code/*` /
  `codex/*` id in deployed config.
- Never extract a subscription OAuth token (`sk-ant-oat…`,
  `CLAUDE_CODE_OAUTH_TOKEN`, `~/.codex/auth.json`) and send it to the
  Anthropic/OpenAI APIs directly — that is the exact circumvention the terms
  prohibit.
- A subscription login must never be copied into Vercel, CI, containers, the
  repository, or any service exposed to other users; it must not be exposed
  through a tunnel, enabled in shared CI, or parallelized to evade provider
  limits.
- Recheck provider terms and documentation before expanding this boundary.

## Alternatives considered

- **Raw subscription OAuth token against the Messages API** — rejected:
  explicit terms violation, and the token shape is undocumented/unstable.
- **CLI subprocesses (`claude -p` / `codex exec`) without the AI SDK** — what
  `sound-it-out` does. Works, but every feature reinvents prompt/schema
  plumbing; the AI SDK adapters give the same subscription auth behind the
  standard `generateText`/`generateObject` interface, and the provider layer
  stays swappable.
- **API keys everywhere (no subscription tier)** — simplest, but makes every
  local iteration a metered spend and was the reason AI features weren't
  getting exercised locally.
- **Vercel AI Gateway as the only deployed path** — still available later by
  adding a gateway tier (career-manager has one); not part of the baseline to
  keep required accounts minimal.

## Consequences

- Local dev is free (subscription allowance) and switching providers is a
  one-line `AI_MODEL` change; production is metered and compliant by
  construction.
- Two community adapters (same maintained family, pinned exact) join the
  dependency tree; they never enter the production bundle. Dependabot bumps to
  them deserve a closer look than official SDK bumps.
- The subscription path has quirks the API path doesn't: a per-call
  input-token floor through Claude Code (mitigated by the trimmed
  `CLAUDE_CODE_SETTINGS`), and the codex adapter's structured-output
  limitations (no optional schema fields; format/regex validators stripped).
  Test against an API tier before shipping schema-heavy features.
- E2E/CI never touches AI: no `AI_MODEL` is configured there, so the layer
  stays inert and no subscription or key is ever needed in shared
  environments.
