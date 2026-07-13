import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

/**
 * Support / "report a bug" form. Public, so an anonymous user can submit; when
 * signed in, name and email prefill from the session.
 */

test("anyone can submit the support form", async ({ page }) => {
	await page.goto("/support");
	await expect(page.getByRole("heading", { name: "Contact support" })).toBeVisible();

	await page.getByLabel("Name").fill("Ada Lovelace");
	await page.getByLabel("Email").fill("ada@example.com");
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
