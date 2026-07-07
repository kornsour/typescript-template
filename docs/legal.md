# Legal disclosures

## Status in this repository

The legal pages currently in `src/app/(legal)/` and values in
`src/content/legal/config.ts` are the **official v1 baseline** for this app and
were reviewed by counsel as an initial launch set. They should be treated as
live policy text, not placeholders.

## What's scaffolded

| Page                  | Route             | Covers                                                        |
| --------------------- | ----------------- | ------------------------------------------------------------- |
| Terms of Service      | `/terms`          | Account terms, billing, IP, liability, governing law          |
| Privacy Policy        | `/privacy`        | What's collected, why, sharing, retention, rights requests    |
| Acceptable Use Policy | `/acceptable-use` | Prohibited conduct, including AI-feature misuse               |
| AI Disclosure         | `/ai-disclosure`  | AI-interaction disclosure, limitations, high-risk-use warning |
| Cookie Policy         | `/cookies`        | Current (essential-only) cookie use                           |

Plus:

- `src/content/legal/config.ts` — company info, governing law, and `LEGAL_VERSION` in one place.
- Sign-up requires an explicit ToS/Privacy checkbox, enforced server-side in `src/lib/auth.ts` (not just client-side), and the accepted version + timestamp is stored on the `user` row.
- `<AiDisclosureNotice>` (`src/components/ai-disclosure-notice.tsx`) — drop into any AI-facing feature's UI so the disclosure is at the point of use.
- `NEXT_PUBLIC_AI_FEATURES_ENABLED` — gates the AI Disclosure footer link; flip on once you ship an AI feature.
- `<CookieBanner>` — a notice, not a consent manager (see "Cookies" below).

## For apps copied from this template

1. Replace `src/content/legal/config.ts` with your own entity name, address/contact channel, governing-law venue, dates, and AI provider list.
2. Ensure all five pages are reviewed by counsel for your own entity and jurisdictional footprint before launch.
3. Decide whether you need a **GDPR/UK GDPR Article 27 representative** — relevant if you have a meaningful EU/UK user base, since a public deployment doesn't geofence itself.
4. Decide whether you want a mandatory-arbitration / class-action-waiver clause in the ToS. Deliberately left out as a business decision, not a default.
5. If you serve B2B customers who ask for a **Data Processing Addendum (DPA)** (common for anyone processing EU personal data as a processor), you'll need one — this template doesn't include a DPA template; that's a negotiated contract, not boilerplate.
6. When you materially change a legal page, bump `LEGAL_VERSION` in `src/content/legal/config.ts`. New sign-ups are gated on the current version automatically; **existing users are not automatically re-prompted** — add that check to `requireUser()`/`getSession()` call sites if you need to force re-acceptance.
7. If you add analytics, ads, or any non-essential tracking cookie, upgrade `src/components/cookie-banner.tsx` from a notice into a real accept/reject consent control _before_ those trackers load, and list them in the Cookie Policy.

## The researched landscape (general awareness, not advice)

**US state consumer-privacy laws.** California's CCPA/CPRA (Cal. Civ. Code
§1798.100 et seq.) is the most prescriptive — rights to know, delete, correct,
and opt out of sale/sharing, plus a specific rights-request channel. Virginia
(VCDPA), Colorado (CPA), Connecticut (CTDPA), Utah (UCPA), and a growing list
of other states have broadly similar (not identical) comprehensive privacy
laws, generally triggered by revenue or data-volume thresholds — check whether
your business meets any state's threshold as you grow.

**Children's privacy.** COPPA applies to services directed at, or that
knowingly collect data from, children under 13; several states have their own
overlays (e.g. age-appropriate design code style laws). The template's default
posture is "not directed to children" — if that's not true for your app, this
needs much more than a footer disclosure.

**GDPR / UK GDPR.** Applies based on _who your users are_, not where your
company is incorporated — a US company with EU/UK visitors can be in scope.
Key differences from US law: you need an affirmative lawful basis for each
processing purpose (not just a disclosure), consent must be opt-in for
non-essential cookies/tracking, and data-subject rights (access, erasure,
portability, objection) are broader than most US state rights.

**AI-specific — the fast-moving part.**

- **Chatbot/bot-disclosure laws** — e.g. California's Bot Disclosure Law (Cal.
  Bus. & Prof. Code §17941) — require disclosing that a user is interacting
  with an automated system, at least in commercial/influence contexts.
- **EU AI Act (Regulation (EU) 2024/1689)** — Article 50 requires informing
  users they're interacting with an AI system (transparency obligation, most
  provisions phased in through 2025–2027); Annex III lists "high-risk" use
  cases (employment, credit, education, law enforcement, etc.) that carry much
  heavier obligations — risk management, human oversight, logging, conformity
  assessment.
- **Colorado AI Act (SB 24-205)** — impact assessments, consumer notice, and a
  correction/appeal path for "high-risk" AI systems used in "consequential
  decisions" about a person.
- **NYC Local Law 144** — bias audits + candidate notice for automated
  employment-decision tools used by NYC employers.
- **California SB 942 (AI Transparency Act)** and **AB 2013 (Training Data
  Transparency Act)** — provenance/detection-tool and training-data-disclosure
  obligations, generally aimed at larger-scale generative-AI providers; check
  applicability as you scale.
- **Utah AI Policy Act** — disclosure obligations for generative AI used in
  certain regulated consumer interactions.
