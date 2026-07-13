import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Sign up a brand-new user through the real UI and land on the dashboard.
 * Returns the generated email. The account is unverified (dev doesn't require
 * verification), which is exactly what the resend-verification tests need.
 */
export async function signUp(page: Page): Promise<{ email: string; name: string }> {
	const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
	const email = `e2e-${stamp}@example.com`;
	const name = "E2E User";
	const password = "correct horse battery staple";

	await page.goto("/sign-up");
	await page.getByLabel("Name").fill(name);
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(password);
	await page.getByLabel("Confirm password").fill(password);
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "Create account" }).click();

	await expect(page).toHaveURL(/\/dashboard/);
	return { email, name };
}
