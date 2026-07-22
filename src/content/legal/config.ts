/**
 * Single source of truth for the legal pages under src/app/(legal)/. Bump
 * LEGAL_VERSION any time those pages materially change.
 *
 * TEMPLATE PLACEHOLDERS — replace every value below with the real company
 * details when creating an app from this template (the provision-app and
 * rename-app skills prompt for this). Don't ship the defaults: they render
 * directly on the public Terms/Privacy pages.
 */
export const LEGAL_VERSION = "1.0";

export const legalConfig = {
	companyName: "Your Company LLC",
	companyEntityType: "a limited liability company",
	registeredAddress: "Available upon written request to the contact email below.",
	contactEmail: "legal@example.com",
	privacyEmail: "privacy@example.com",
	// Where the /support form delivers messages. Point this at your support inbox
	// or shared group (the provision-app skill can create a support@ group).
	supportEmail: "support@example.com",
	governingLawState: "Delaware",
	governingLawVenue: "New Castle County, Delaware",
	effectiveDate: "January 1, 2026",
	lastUpdated: "January 1, 2026",
	aiSubprocessors: [],
} as const;
