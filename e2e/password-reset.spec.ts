import { expect, test } from "@playwright/test";

/**
 * Password-reset UI flows. These exercise the forgot-password → reset-password
 * pages the app ships. (A full reset needs the emailed token, which isn't
 * available to the browser; the prod render-smoke covers server-render, so here
 * we cover the interactive behavior: confirmation, the invalid-token state, and
 * client-side validation.)
 */

test("forgot-password shows a confirmation after submitting", async ({ page }) => {
	await page.goto("/forgot-password");
	await page.getByPlaceholder("you@example.com").fill("someone@example.com");
	await page.getByRole("button", { name: "Send reset link" }).click();
	await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
});

test("reset-password without a token is a dead end with a way out", async ({ page }) => {
	await page.goto("/reset-password");
	await expect(page.getByText("This reset link is invalid or has expired.")).toBeVisible();
	await page.getByRole("link", { name: "Request a new link" }).click();
	await expect(page).toHaveURL(/\/forgot-password/);
});

test("reset-password with a token renders the form and validates mismatches", async ({ page }) => {
	await page.goto("/reset-password?token=e2e-fake-token");
	await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();

	await page.getByPlaceholder("New password", { exact: true }).fill("correct horse battery staple");
	await page.getByPlaceholder("Confirm new password").fill("different password entirely");
	await page.getByRole("button", { name: "Reset password" }).click();

	await expect(page.getByText("Passwords don't match.")).toBeVisible();
});
