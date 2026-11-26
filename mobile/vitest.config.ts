import { defineConfig } from "vitest/config";

// Unit tests cover the pure logic in src/lib only: no React Native runtime here,
// so a module under test must not import react-native or expo-*.
export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
	// Don't pick up the web app's PostCSS/Tailwind config from the repo root.
	css: { postcss: {} },
});
