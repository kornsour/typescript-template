import { describe, expect, it } from "vitest";
import { type ApiUrlInput, resolveApiUrl } from "./api-url";

const dev: ApiUrlInput = { envUrl: undefined, hostUri: undefined, isDev: true, platform: "ios" };

describe("resolveApiUrl", () => {
	it("prefers EXPO_PUBLIC_API_URL and strips trailing slashes", () => {
		expect(
			resolveApiUrl({ ...dev, envUrl: " https://app.example.com/ ", hostUri: "192.168.1.5:8081" }),
		).toBe("https://app.example.com");
	});

	it("rejects values that are not an http(s) origin", () => {
		for (const envUrl of ["app.example.com", "ftp://x", "https://x.com/api", "https://x.com?a=1"]) {
			expect(() => resolveApiUrl({ ...dev, envUrl })).toThrow(/http\(s\) origin/);
		}
	});

	it("derives the LAN host from the Expo dev server in development", () => {
		expect(resolveApiUrl({ ...dev, hostUri: "192.168.1.20:8081" })).toBe(
			"http://192.168.1.20:3000",
		);
		expect(resolveApiUrl({ ...dev, hostUri: "[fd00::1]:8081", platform: "android" })).toBe(
			"http://[fd00::1]:3000",
		);
	});

	it.each([undefined, "", "localhost:8081", "127.0.0.1:8081"])(
		"falls back per platform for hostUri %s",
		(hostUri) => {
			expect(resolveApiUrl({ ...dev, hostUri })).toBe("http://localhost:3000");
			expect(resolveApiUrl({ ...dev, hostUri, platform: "android" })).toBe("http://10.0.2.2:3000");
		},
	);

	it("explains that tunnel mode needs an explicit URL", () => {
		expect(() => resolveApiUrl({ ...dev, hostUri: "abc-8081.exp.direct:80" })).toThrow(/tunnel/);
	});

	it("fails loudly in production without the variable", () => {
		for (const envUrl of [undefined, "", "   "]) {
			expect(() =>
				resolveApiUrl({ ...dev, envUrl, isDev: false, hostUri: "192.168.1.20:8081" }),
			).toThrow(/EXPO_PUBLIC_API_URL is not set/);
		}
	});
});
