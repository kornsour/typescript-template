"use client";

import { Button, Input } from "@kornorg/design-system";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { MIN_PASSWORD_LENGTH, passwordError } from "@/lib/password";

function ResetForm() {
	const router = useRouter();
	const params = useSearchParams();
	const token = params.get("token");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	if (!token) {
		return <p className="text-sm text-destructive">This reset link is invalid or has expired.</p>;
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
			<h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
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

export default function ResetPasswordPage() {
	return (
		<Suspense>
			<ResetForm />
		</Suspense>
	);
}
