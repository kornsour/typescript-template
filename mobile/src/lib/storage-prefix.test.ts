import { APP_SCHEME } from "@app/shared/app";
import { describe, expect, it } from "vitest";
import appJson from "../../app.json";
import { toStoragePrefix } from "./storage-prefix";

describe("toStoragePrefix", () => {
	it("only produces characters SecureStore accepts", () => {
		expect(toStoragePrefix("my+app:dev/x y")).toBe("my_app_dev_x_y");
		expect(toStoragePrefix(APP_SCHEME)).toMatch(/^[\w.-]+$/);
	});
});

describe("app scheme", () => {
	it("matches expo.scheme in app.json", () => {
		expect(appJson.expo.scheme).toBe(APP_SCHEME);
	});
});
