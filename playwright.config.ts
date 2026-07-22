import { defineConfig, devices } from "@playwright/test";

// Override with E2E_PORT when localhost:3000 is taken (e.g. another project's
// dev server). Also set NEXT_PUBLIC_APP_URL=http://localhost:<port> so auth
// origins match the server Playwright boots.
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "html",
	use: {
		baseURL,
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: `pnpm dev --port ${port}`,
		url: baseURL,
		reuseExistingServer: !process.env.CI,
	},
});
