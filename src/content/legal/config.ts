/**
 * Single source of truth for the legal pages under src/app/(legal)/. Bump
 * LEGAL_VERSION any time those pages materially change.
 */
export const LEGAL_VERSION = "1.0";

export const legalConfig = {
	companyName: "Kaiserauer Solutions LLC",
	companyEntityType: "a Michigan limited liability company",
	registeredAddress: "Available upon written request to the contact email below.",
	contactEmail: "ajkaiserauer@gmail.com",
	privacyEmail: "ajkaiserauer@gmail.com",
	governingLawState: "Michigan",
	governingLawVenue: "Wayne County, Michigan",
	effectiveDate: "July 6, 2026",
	lastUpdated: "July 6, 2026",
	aiSubprocessors: [],
} as const;
