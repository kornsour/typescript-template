import { meResponseSchema } from "@app/shared/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const getSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

const request = () =>
	new Request("http://localhost:3000/api/me", {
		headers: { cookie: "better-auth.session_token=abc" },
	});

describe("GET /api/me", () => {
	beforeEach(() => {
		getSession.mockReset();
	});

	it("answers 401 without a session", async () => {
		getSession.mockResolvedValue(null);

		const response = await GET(request());

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized" });
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});

	it("returns only the contract fields for a signed-in user", async () => {
		getSession.mockResolvedValue({
			session: { id: "s1", token: "secret-token", userId: "u1" },
			user: {
				id: "u1",
				name: "Ada",
				email: "ada@example.com",
				emailVerified: true,
				image: "https://example.com/ada.png",
				createdAt: new Date(),
				updatedAt: new Date(),
				legalAcceptedVersion: "1.0",
				legalAcceptedAt: new Date(),
			},
		});

		const response = await GET(request());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({
			user: { id: "u1", name: "Ada", email: "ada@example.com", emailVerified: true },
		});
		expect(meResponseSchema.safeParse(body).success).toBe(true);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});

	it("looks the session up from the request headers without refreshing it", async () => {
		getSession.mockResolvedValue(null);
		const incoming = request();

		await GET(incoming);

		expect(getSession).toHaveBeenCalledWith({
			headers: incoming.headers,
			query: { disableRefresh: true },
		});
	});
});
