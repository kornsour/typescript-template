"use client";

import { Button, Input } from "@kornorg/design-system";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { MIN_PASSWORD_LENGTH, passwordError } from "@/lib/password";

/**
 * Reset-password form. The token is read on the server (from the page's
 * `searchParams`) and passed in as a prop — deliberately NOT via
 * `useSearchParams()`. A client page that reads search params renders a
 * client-only shell, which paints blank under the production strict-nonce CSP;
 * taking the token as a prop keeps the form in the server-rendered HTML.
 */
export function ResetPasswordForm({ token }: { token: string | null }) {
	const router = useRouter();
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	if (!token) {
		return (
			<div className="flex flex-col gap-4">
				<p className="text-sm text-destructive">This reset link is invalid or has expired.</p>
				<Link href="/forgot-password" className="text-sm font-medium hover:underline">
					Request a new link
				</Link>
			</div>
		);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		const firstErr =
			passwordError(password) || (password !== confirm ? "Passwords don't match." : null);
		if (firstErr) {
			setError(firstErr);
			return;
		}
		setPending(true);
		// Narrowed by the `if (!token)` guard above, but TS can't see that inside
		// this closure — cast to satisfy the type.
		const res = await authClient.resetPassword({ newPassword: password, token: token as string });
		setPending(false);
		if (res.error) {
			setError(res.error.message ?? "Could not reset password.");
			return;
		}
		router.push("/sign-in");
	}

	return (
		<form onSubmit={onSubmit} className="flex flex-col gap-4">
			<Input
				type="password"
				value={password}
				onChange={(e) => setPassword(e.target.value)}
				placeholder="New password"
				autoComplete="new-password"
				minLength={MIN_PASSWORD_LENGTH}
				required
			/>
			<Input
				type="password"
				value={confirm}
				onChange={(e) => setConfirm(e.target.value)}
				placeholder="Confirm new password"
				autoComplete="new-password"
				required
			/>
			{error && <p className="text-sm text-destructive">{error}</p>}
			<Button type="submit" disabled={pending}>
				{pending ? "Saving…" : "Reset password"}
			</Button>
			<Link href="/sign-in" className="text-center text-sm text-muted-foreground hover:underline">
				Back to sign in
			</Link>
		</form>
	);
}
