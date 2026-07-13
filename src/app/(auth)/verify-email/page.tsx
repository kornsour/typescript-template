"use client";

import { Button, Input } from "@kornorg/design-system";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function VerifyEmailPage() {
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setPending(true);
		// Always report success to avoid leaking which emails are registered or
		// already verified — the endpoint is enumeration-safe (constant-time) when
		// called without a session, and only actually sends for an unverified user.
		await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" });
		setPending(false);
		setSent(true);
	}

	if (sent) {
		return (
			<div className="flex flex-col gap-4">
				<h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
				<p className="text-sm text-muted-foreground">
					If {email} has an account that isn't verified yet, a new verification link is on its way.
				</p>
				<Link href="/sign-in" className="text-sm font-medium hover:underline">
					Back to sign in
				</Link>
			</div>
		);
	}

	return (
		<form onSubmit={onSubmit} className="flex flex-col gap-4">
			<h1 className="text-xl font-semibold tracking-tight">Resend verification email</h1>
			<p className="text-sm text-muted-foreground">
				Didn't get the link, or it expired? Enter your email and we'll send a new one.
			</p>
			<Input
				type="email"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				placeholder="you@example.com"
				autoComplete="email"
				required
			/>
			<Button type="submit" disabled={pending}>
				{pending ? "Sending…" : "Send verification link"}
			</Button>
			<Link href="/sign-in" className="text-center text-sm text-muted-foreground hover:underline">
				Back to sign in
			</Link>
		</form>
	);
}
