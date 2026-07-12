"use client";

import { Button, Input } from "@kornorg/design-system";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setPending(true);
		// Always report success to avoid leaking which emails are registered.
		await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
		setPending(false);
		setSent(true);
	}

	if (sent) {
		return (
			<div className="flex flex-col gap-4">
				<h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
				<p className="text-sm text-muted-foreground">
					If an account exists for {email}, a password-reset link is on its way.
				</p>
				<Link href="/sign-in" className="text-sm font-medium hover:underline">
					Back to sign in
				</Link>
			</div>
		);
	}

	return (
		<form onSubmit={onSubmit} className="flex flex-col gap-4">
			<h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
			<p className="text-sm text-muted-foreground">
				Enter your email and we'll send you a reset link.
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
				{pending ? "Sending…" : "Send reset link"}
			</Button>
		</form>
	);
}
