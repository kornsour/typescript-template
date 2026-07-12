"use client";

import { Button } from "@kornorg/design-system";
import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "cookie-notice-dismissed";

/**
 * A notice, not a consent manager: this template only sets strictly necessary
 * cookies (auth session + OAuth state), which don't legally require opt-in
 * consent — just clear disclosure. If you add analytics/ads/tracking cookies,
 * replace this with a real accept/reject control before they load. See
 * src/app/(legal)/cookies/page.tsx.
 */
export function CookieBanner() {
	const [dismissed, setDismissed] = useState(true);

	useEffect(() => {
		setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
	}, []);

	if (dismissed) return null;

	function dismiss() {
		localStorage.setItem(STORAGE_KEY, "1");
		setDismissed(true);
	}

	return (
		<div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-4 py-3 text-sm text-muted-foreground shadow-lg">
			<div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3">
				<p>
					We use essential cookies to keep you signed in and to run this site. See our{" "}
					<Link href="/cookies" className="underline underline-offset-2">
						Cookie Policy
					</Link>
					.
				</p>
				<Button type="button" size="sm" onClick={dismiss}>
					Got it
				</Button>
			</div>
		</div>
	);
}
