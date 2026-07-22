import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

/**
 * Support / "report a bug" form. Public, so an anonymous user can submit; when
 * signed in, name and email prefill from the session.
 *
 * The server rate-limits by (hashed) client IP and by email, counted against
 * stored submissions — so repeated local runs would trip it. Each run therefore
 * spoofs a unique `x-forwarded-for` (the dev server trusts the header; Vercel
 * overwrites it in production) and uses run-unique emails.
 */

const runId = randomUUID();

test.use({ extraHTTPHeaders: { "x-forwarded-for": `e2e-${runId}` } });

test("anyone can submit the support form", async ({ page }) => {
	await page.goto("/support");
	await expect(page.getByRole("heading", { name: "Contact support" })).toBeVisible();

	await page.getByLabel("Name").fill("Ada Lovelace");
	await page.getByLabel("Email").fill(`ada-${runId}@example.com`);
	await page
		.getByLabel("Message")
		.fill("The dashboard button does nothing when I click it on mobile Safari.");
	await page.getByRole("button", { name: "Send message" }).click();

	await expect(page.getByRole("heading", { name: "Thanks — we got it" })).toBeVisible();
});

test("required fields gate submission", async ({ page }) => {
	await page.goto("/support");
	// Submitting empty relies on native required-field validation, so the form
	// should NOT reach the success state.
	await page.getByRole("button", { name: "Send message" }).click();
	await expect(page.getByRole("heading", { name: "Thanks — we got it" })).toBeHidden();
	await expect(page.getByRole("heading", { name: "Contact support" })).toBeVisible();
});

test("support form prefills name and email for a signed-in user", async ({ page }) => {
	const { email, name } = await signUp(page);

	await page.goto("/support");
	await expect(page.getByLabel("Name")).toHaveValue(name);
	await expect(page.getByLabel("Email")).toHaveValue(email);

	await page.getByLabel("Message").fill("Just checking the prefill works end to end.");
	await page.getByRole("button", { name: "Send message" }).click();
	await expect(page.getByRole("heading", { name: "Thanks — we got it" })).toBeVisible();
});

test.describe("rate limiting", () => {
	// Isolated IP so this test's submissions don't count against the ones above.
	test.use({ extraHTTPHeaders: { "x-forwarded-for": `e2e-ratelimit-${runId}` } });

	test("blocks a burst of submissions from the same sender", async ({ page }) => {
		// Per-email limit is 3/hour (src/lib/support/anti-spam.ts RATE_LIMITS);
		// the 4th submission from the same address must be rejected.
		const email = `burst-${runId}@example.com`;
		for (let i = 1; i <= 3; i++) {
			await page.goto("/support");
			await page.getByLabel("Name").fill("Burst Bot");
			await page.getByLabel("Email").fill(email);
			await page.getByLabel("Message").fill(`Rapid-fire message number ${i} of the burst.`);
			await page.getByRole("button", { name: "Send message" }).click();
			await expect(page.getByRole("heading", { name: "Thanks — we got it" })).toBeVisible();
		}

		await page.goto("/support");
		await page.getByLabel("Name").fill("Burst Bot");
		await page.getByLabel("Email").fill(email);
		await page.getByLabel("Message").fill("Rapid-fire message number 4 of the burst.");
		await page.getByRole("button", { name: "Send message" }).click();

		await expect(page.getByText("Too many messages — please try again later.")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Thanks — we got it" })).toBeHidden();
	});
});
