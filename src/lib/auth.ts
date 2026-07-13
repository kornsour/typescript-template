import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { LEGAL_VERSION } from "@/content/legal/config";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, passwordError } from "@/lib/password";

/**
 * Lifetime of reset-password and email-verification links. Pinned explicitly (a
 * single source of truth) so the value in the email copy can't drift from the
 * value better-auth enforces.
 */
const LINK_EXPIRY_SECONDS = 60 * 60;
const LINK_EXPIRY_LABEL = "1 hour";

/** Only enable a social provider when both its id and secret are present. */
const socialProviders = {
	...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
		? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
		: {}),
	...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
		? { apple: { clientId: env.APPLE_CLIENT_ID, clientSecret: env.APPLE_CLIENT_SECRET } }
		: {}),
};

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification,
		},
	}),
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.NEXT_PUBLIC_APP_URL,
	user: {
		additionalFields: {
			legalAcceptedVersion: { type: "string", required: false, input: true },
			legalAcceptedAt: { type: "date", required: false, input: true },
		},
	},
	emailAndPassword: {
		enabled: true,
		minPasswordLength: MIN_PASSWORD_LENGTH,
		maxPasswordLength: MAX_PASSWORD_LENGTH,
		// Only block sign-in on unverified email in production, so local dev and
		// e2e stay frictionless. The verification email is still sent below.
		requireEmailVerification: env.NODE_ENV === "production",
		resetPasswordTokenExpiresIn: LINK_EXPIRY_SECONDS,
		sendResetPassword: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Reset your password",
				text: `Reset your password by opening this link:\n\n${url}\n\nThis link expires in ${LINK_EXPIRY_LABEL}. If you didn't request this, you can ignore this email.`,
			});
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		// Re-send a fresh link whenever an unverified user tries to sign in, so a
		// lost/expired first email self-heals: they just attempt sign-in again. In
		// production this pairs with `requireEmailVerification` — the sign-in is
		// rejected with EMAIL_NOT_VERIFIED and a new link goes out. Users can also
		// request one explicitly at /verify-email.
		sendOnSignIn: true,
		autoSignInAfterVerification: true,
		expiresIn: LINK_EXPIRY_SECONDS,
		sendVerificationEmail: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Verify your email",
				text: `Confirm your email address by opening this link:\n\n${url}\n\nThis link expires in ${LINK_EXPIRY_LABEL}.`,
			});
		},
	},
	socialProviders,
	account: {
		accountLinking: {
			// Let a social sign-in attach to an existing account with the same email
			// (e.g. someone who signed up with a password can also "Continue with
			// Google" and land in the same account, and Google/Apple cross-link too).
			enabled: true,
			// Trust whichever social providers are configured: their email is
			// provider-verified, so it's safe to link on an email match. We keep
			// `requireLocalEmailVerified` at its secure default (true) — the
			// pre-existing password account must have verified its own email before a
			// social login can link into it, which blocks account pre-hijacking (an
			// attacker pre-creating a password account for someone else's address).
			trustedProviders: Object.keys(socialProviders),
		},
	},
	// better-auth's built-in limiter; auth routes get stricter per-path limits.
	rateLimit: {
		enabled: true,
		window: 60,
		max: 100,
	},
	hooks: {
		// Server-side password policy (defense in depth — the client form can be
		// bypassed). Enforces the full policy in src/lib/password.ts, not just the
		// min length better-auth checks natively.
		before: createAuthMiddleware(async (ctx) => {
			if (ctx.path === "/sign-up/email" || ctx.path === "/reset-password") {
				const pw = (ctx.body as { password?: string } | undefined)?.password;
				if (typeof pw === "string") {
					const err = passwordError(pw);
					if (err) throw new APIError("BAD_REQUEST", { message: err });
				}
			}
			// Server-side consent gate (defense in depth — the client checkbox in
			// auth-form.tsx can be bypassed). Requires the client to submit the
			// LEGAL_VERSION it displayed, so a stale/cached form can't sneak past a
			// terms update either.
			if (ctx.path === "/sign-up/email") {
				const version = (ctx.body as { legalAcceptedVersion?: string } | undefined)
					?.legalAcceptedVersion;
				if (version !== LEGAL_VERSION) {
					throw new APIError("BAD_REQUEST", {
						message: "You must accept the current Terms of Service and Privacy Policy.",
					});
				}
			}
		}),
	},
	// Ensures Set-Cookie headers from server actions are persisted (App Router).
	plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
