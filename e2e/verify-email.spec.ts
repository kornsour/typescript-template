import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

/**
 * Email-verification resend flows: the standalone /verify-email page (for anyone,
 * signed in or not) and the one-click resend on the dashboard's unverified
 * notice (for a signed-in but unverified user).
 */

test("/verify-email confirms after requesting a new link", async ({ page }) => {
	await page.goto("/verify-email");
	await page.getByPlaceholder("you@example.com").fill("someone@example.com");
	await page.getByRole("button", { name: "Send verification link" }).click();
	await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
});

test("dashboard lets an unverified user resend the verification email", async ({ page }) => {
	await signUp(page);

	// A freshly signed-up user is unverified, so the notice + resend button show.
	await expect(page.getByText("Your email isn't verified yet")).toBeVisible();
	const resend = page.getByRole("button", { name: "Resend verification email" });
	await expect(resend).toBeVisible();

	await resend.click();
	await expect(page.getByText(/Sent — check your inbox/)).toBeVisible();
});
