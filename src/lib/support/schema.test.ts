import { describe, expect, it } from "vitest";
import { SUPPORT_CATEGORIES, supportSchema } from "./schema";

describe("supportSchema", () => {
	const valid = {
		name: "Ada Lovelace",
		email: "ada@example.com",
		category: "Bug" as const,
		message: "Something is broken on the dashboard when I click resend.",
	};

	it("accepts a well-formed request", () => {
		expect(supportSchema.safeParse(valid).success).toBe(true);
	});

	it("trims and still requires a name", () => {
		expect(supportSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
	});

	it("rejects an invalid email", () => {
		expect(supportSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
	});

	it("rejects a too-short message", () => {
		expect(supportSchema.safeParse({ ...valid, message: "too short" }).success).toBe(false);
	});

	it("rejects an unknown category", () => {
		expect(supportSchema.safeParse({ ...valid, category: "Sales" }).success).toBe(false);
	});

	it("exposes the categories the form renders", () => {
		expect(SUPPORT_CATEGORIES).toContain("Bug");
		expect(SUPPORT_CATEGORIES.length).toBeGreaterThan(0);
	});
});
