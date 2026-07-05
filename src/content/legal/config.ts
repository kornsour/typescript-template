/**
 * Single source of truth for the legal pages under src/app/(legal)/.
 *
 * NOT LEGAL ADVICE. Fill in every "TODO" below, then have a licensed attorney
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
	// TODO: your registered business name, e.g. "Acme Software, Inc."
	companyName: "[YOUR COMPANY LEGAL NAME]",
	// TODO: e.g. "a Michigan limited liability company" / "a Delaware corporation"
	companyEntityType: "[YOUR ENTITY TYPE AND STATE OF FORMATION]",
	// TODO: your registered/principal business address (required in most privacy
	// policies and many state ToS disclosure rules).
	registeredAddress: "[STREET ADDRESS, CANTON, MI ZIP]",
	// TODO: general and privacy-specific contact addresses. Many state privacy
	// laws (and GDPR) require a specific channel for rights requests.
	contactEmail: "legal@yourdomain.com",
	privacyEmail: "privacy@yourdomain.com",
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
