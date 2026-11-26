import { describe, expect, it } from "vitest";
import { authErrorMessage, isEmailNotVerified } from "./auth-errors";

describe("auth errors", () => {
	it("detects an unverified email", () => {
		expect(isEmailNotVerified({ code: "EMAIL_NOT_VERIFIED", status: 403 })).toBe(true);
		expect(isEmailNotVerified({ code: "INVALID_EMAIL_OR_PASSWORD" })).toBe(false);
	});

	it("prefers the server message, with fallbacks", () => {
		expect(authErrorMessage({ message: "Invalid email or password" })).toBe(
			"Invalid email or password",
		);
		expect(authErrorMessage({ message: "" })).toMatch(/Something went wrong/);
		expect(authErrorMessage({ status: 429, message: "x" })).toMatch(/Too many attempts/);
	});
});
