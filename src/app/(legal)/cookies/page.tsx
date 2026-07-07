import type { Metadata } from "next";
import { LEGAL_VERSION, legalConfig } from "@/content/legal/config";

export const metadata: Metadata = { title: "Cookie Policy" };

export default function CookiesPage() {
	const c = legalConfig;
	return (
		<>
			<h1>Cookie Policy</h1>
			<p>
				Version {LEGAL_VERSION} · Effective {c.effectiveDate} · Last updated {c.lastUpdated}
			</p>

			<h2>1. What we use today</h2>
			<p>
				As shipped, this template only sets <strong>strictly necessary</strong> cookies: a signed
				session cookie (set by better-auth) used to keep you signed in, and — if you use Google or
				Apple sign-in — a short-lived state cookie used to complete that OAuth flow. Under
				GDPR/ePrivacy and similar laws, strictly necessary cookies don't require consent, only clear
				disclosure — which is what this page and the cookie notice banner provide.
			</p>

			<h2>2. If you add analytics, ads, or other tracking</h2>
			<p>
				We do not currently use analytics, advertising, or other non-essential trackers. If we add
				any non-essential cookies in the future, we will update this policy to list each cookie's
				purpose and duration and implement any legally required consent controls before those
				cookies are set.
			</p>

			<h2>3. Managing cookies</h2>
			<p>
				Most browsers let you block or delete cookies in their settings. Blocking the session cookie
				will sign you out and may prevent you from using features that require an account.
			</p>

			<h2>4. Contact</h2>
			<p>Questions about our cookie use: {c.privacyEmail}.</p>
		</>
	);
}
