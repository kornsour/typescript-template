/**
 * Single source of truth for the legal pages under src/app/(legal)/.
 *
 * Fill in every "TODO" below, then have a licensed attorney
 * (in your state of operation, plus any other jurisdiction with a meaningful
 * user base — e.g. the EU/UK) review the pages in src/app/(legal)/ before
 * launch. See docs/legal.md.
 *
 * Bump LEGAL_VERSION any time the legal pages change in a way existing users
 * should re-acknowledge; src/lib/auth.ts compares a signing-up user's
 * submitted version against this constant.
 */
export const LEGAL_VERSION = "1.0";

export const legalConfig = {
  companyName: "Kaiserauer Solutions LLC",
  companyEntityType: "a Michigan limited liability company",
  // No published street address yet — offered on request instead of publishing
  // a home address. Revisit if a jurisdiction you operate in requires one
  // printed on the page itself.
  registeredAddress:
    "Available upon written request to the contact email below.",
  // Per-app repos should override these to that app's own domain
  // (e.g. support@<app>.com) once support-email routing is set up.
  contactEmail: "ajkaiserauer@gmail.com",
  privacyEmail: "ajkaiserauer@gmail.com",
  // Governing law / venue for the ToS. Defaults to the founder's home state;
  // change if you incorporate elsewhere.
  governingLawState: "Michigan",
  governingLawVenue: "Wayne County, Michigan",
  // TODO: set a real effective date before launch, and update lastUpdated
  // every time you materially change a policy (and bump LEGAL_VERSION above).
  effectiveDate: "[EFFECTIVE DATE — SET BEFORE LAUNCH]",
  lastUpdated: "[LAST UPDATED DATE]",
  // Shown alongside the AI disclosure. List the third-party model/inference
  // providers your app actually sends user input to (e.g. "OpenAI", "Anthropic").
  aiSubprocessors: ["[YOUR AI PROVIDER(S), e.g. OpenAI, Anthropic]"],
} as const;
