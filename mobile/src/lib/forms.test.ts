import { LEGAL_VERSION } from "@app/shared/legal";
import { describe, expect, it } from "vitest";
import { type SignUpValues, validateSignIn, validateSignUp } from "./forms";

const valid: SignUpValues = {
	name: " Ada Lovelace ",
	email: " ada@example.com ",
	password: "correct horse battery",
	confirmPassword: "correct horse battery",
	acceptedTerms: true,
};

describe("validateSignIn", () => {
	it("accepts an email and any non-empty password, trimming the email", () => {
		expect(validateSignIn({ email: " ada@example.com ", password: "x" })).toEqual({
			ok: true,
			data: { email: "ada@example.com", password: "x" },
		});
	});

	it("reports both fields", () => {
		const result = validateSignIn({ email: "nope", password: "" });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(Object.keys(result.errors)).toEqual(["email", "password"]);
	});
});

describe("validateSignUp", () => {
	it("builds the request with the accepted legal version and time", () => {
		const now = new Date("2026-01-02T03:04:05Z");
		expect(validateSignUp(valid, now)).toEqual({
			ok: true,
			data: {
				name: "Ada Lovelace",
				email: "ada@example.com",
				password: "correct horse battery",
				legalAcceptedVersion: LEGAL_VERSION,
				legalAcceptedAt: now,
			},
		});
	});

	it("requires accepting the terms", () => {
		const result = validateSignUp({ ...valid, acceptedTerms: false });
		expect(result).toMatchObject({ ok: false, errors: { acceptedTerms: expect.any(String) } });
	});

	it("reports every invalid field at once", () => {
		const result = validateSignUp({
			name: "  ",
			email: "ada",
			password: "short",
			confirmPassword: "different",
			acceptedTerms: false,
		});
		expect(result).toEqual({
			ok: false,
			errors: {
				name: "Enter your name.",
				email: "Enter a valid email address.",
				password: "Use at least 12 characters.",
				confirmPassword: "Passwords don't match.",
				acceptedTerms: expect.any(String),
			},
		});
	});

	it("applies the shared password blocklist", () => {
		const common = validateSignUp({
			...valid,
			password: "changemenow12",
			confirmPassword: "changemenow12",
		});
		expect(common).toMatchObject({
			ok: false,
			errors: { password: expect.stringContaining("too common") },
		});
	});
});
