# ADR-0015: Legal-disclosure page scaffolding (ToS, Privacy, AUP, AI Disclosure, Cookies)

- Status: Accepted
- Date: 2026-07-05

## Context

Apps built from this template collect accounts, take payments, and — for many
apps built on it — put an AI feature directly in front of end users. That
combination sits under several overlapping legal regimes: US state consumer-
privacy laws (CCPA/CPRA and similar in VA/CO/CT/UT/etc.), GDPR/UK GDPR if any
EU/UK visitors show up (which a public Vercel deployment doesn't prevent),
COPPA, and a fast-moving set of AI-specific transparency/disclosure laws
(chatbot-disclosure statutes, the EU AI Act's Article 50 transparency
obligation, and "high-risk"/consequential-decision regimes like the Colorado AI
Act and NYC Local Law 144). Shipping with no legal pages at all, or shipping
with generic legal pages that don't mention AI, are both worse starting points
than a scaffold that at least names the right categories.

Make it structurally hard to forget the
legal-disclosure surface a real launch needs, and put the AI-specific
disclosure at the point of use, not just buried in a footer link.

## Decision

- Five pages under `src/app/(legal)/`: `terms`, `privacy`, `acceptable-use`,
  `ai-disclosure`, `cookies`. Full starter boilerplate text (not just section
  headers), each carrying a visible `LegalTemplateNotice` banner stating it's
  unreviewed template text.
- `src/content/legal/config.ts` centralizes the fill-in-before-launch facts
  (company name/entity/address, contact emails, governing law, AI
  sub-processors) plus a `LEGAL_VERSION` constant, so there's one place to edit
  and one place to bump when policies materially change.
- Sign-up requires an explicit "I agree to the Terms and Privacy Policy"
  checkbox (`src/components/auth-form.tsx`), enforced **server-side** in
  `src/lib/auth.ts`'s existing `before` hook (the same defense-in-depth pattern
  already used for password policy) — a request missing or mismatching the
  current `LEGAL_VERSION` is rejected, not just soft-validated client-side.
  Acceptance is persisted on the `user` row (`legalAcceptedVersion`,
  `legalAcceptedAt`) via better-auth's `additionalFields`, so there's an
  auditable record of what a user agreed to and when.
- `NEXT_PUBLIC_AI_FEATURES_ENABLED` gates the AI Disclosure footer link, same
  pattern as `NEXT_PUBLIC_GOOGLE_ENABLED`/`NEXT_PUBLIC_APPLE_ENABLED` — apps
  built on this template that never add an AI feature shouldn't show an AI
  disclosure link that doesn't apply to them.
- `<AiDisclosureNotice>` (`src/components/ai-disclosure-notice.tsx`) is a small
  reusable component meant to be dropped directly into whatever AI-facing UI a
  given app builds (e.g. under a chat input), so the "you're talking to AI, it
  can be wrong" disclosure sits at the point of interaction — most
  chatbot-disclosure statutes and the EU AI Act care about the user-facing
  moment, not just a page reachable from the footer.
- `<CookieBanner>` is a notice, not a consent manager: the template only sets
  strictly-necessary cookies (auth session, OAuth state), which don't require
  opt-in consent under GDPR/ePrivacy, only disclosure. `docs/legal.md` and the
  Cookie Policy page both flag that adding analytics/ads/tracking cookies later
  requires upgrading this to a real accept/reject control first.
- `docs/legal.md` is the pre-launch checklist and a summary of the researched
  landscape (with named statutes)

## Consequences

- Every app built from this template starts with the legal-page surface wired
  up (routes, footer links, sign-up gating, versioned acceptance tracking) —
  but the actual legal text is still template boilerplate. Shipping without
  attorney review is a choice each app makes for itself; this ADR doesn't
  change that responsibility, it just makes the gap visible (`LegalTemplateNotice`)
  instead of silent.
- `LEGAL_VERSION` bump on a policy change flips existing users' stored version
  out of sync with the current constant; this template does not (yet) force
  re-acceptance for existing sessions on a version bump — only new sign-ups are
  gated. An app that needs to force re-acceptance on existing users should add
  that check to `requireUser()`/`getSession()` call sites.
- `high-risk`/consequential-decision AI use (employment, credit, housing,
  insurance, healthcare, education) needs more than what's here — impact
  assessments, human-review/appeal paths, and jurisdiction-specific notices.
  The AI Disclosure page flags this explicitly rather than implying the default
  disclosure covers it.
