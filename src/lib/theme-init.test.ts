import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { THEME_INIT, THEME_INIT_CSP_HASH } from "./theme-init";

describe("theme-init CSP hash", () => {
	it("matches the SHA-256 of the inline script (else the CSP would block it)", () => {
		const hash = `sha256-${createHash("sha256").update(THEME_INIT, "utf8").digest("base64")}`;
		expect(THEME_INIT_CSP_HASH).toBe(hash);
	});
});
