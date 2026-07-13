"use client";

import { Button } from "@kornorg/design-system";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * One-click "resend verification email" for a signed-in but unverified user.
 * The email is known server-side, so there's nothing to type — we pass it
 * straight to better-auth's send-verification-email endpoint (which verifies it
 * matches the session). Not-signed-in users use the /verify-email page instead.
 */
export function ResendVerificationButton({ email }: { email: string }) {
	const [status, setStatus] = useState<"idle" | "pending" | "sent" | "error">("idle");

	async function resend() {
		setStatus("pending");
		const res = await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" });
		setStatus(res.error ? "error" : "sent");
	}

	if (status === "sent") {
		return (
			<p className="mt-2 text-xs text-muted-foreground">
				Sent — check your inbox (or the dev server console).
			</p>
		);
	}

	return (
		<div className="mt-2 flex items-center gap-3">
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={resend}
				disabled={status === "pending"}
			>
				{status === "pending" ? "Sending…" : "Resend verification email"}
			</Button>
			{status === "error" && (
				<span className="text-xs text-destructive">Couldn't send. Try again.</span>
			)}
		</div>
	);
}
