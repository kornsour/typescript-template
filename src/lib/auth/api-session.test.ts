import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
	auth: { api: { getSession: async () => ({ user: { id: "u1" } }) } },
}));

const { withApiSession } = await import("./api-session");

describe("withApiSession", () => {
	it("marks a response with immutable headers as uncacheable", async () => {
		const route = withApiSession(() => Response.redirect("https://app.example.com/x", 302));
		const response = await route(new Request("https://app.example.com/api/x"));
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("https://app.example.com/x");
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});
});
