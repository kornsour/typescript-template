"use client";

import { Button, Checkbox, Input, Label } from "@kornorg/design-system";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LEGAL_VERSION } from "@/content/legal/config";
import { env } from "@/env";
import { signIn, signUp } from "@/lib/auth-client";
import { MIN_PASSWORD_LENGTH, passwordError, passwordScore, STRENGTH_LABELS } from "@/lib/password";

const AFTER_AUTH = "/dashboard";
const BAR_COLORS = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-lime-500", "bg-green-600"];

function StrengthBar({ score }: { score: number }) {
	return (
		<div className="mt-1 flex gap-1" aria-hidden>
			{[0, 1, 2, 3].map((i) => (
				<div
					key={i}
					className={`h-1 flex-1 rounded-full ${i < score ? BAR_COLORS[score] : "bg-muted"}`}
				/>
			))}
		</div>
	);
}

function OAuthButtons({ next }: { next: string }) {
	const anyEnabled = env.NEXT_PUBLIC_GOOGLE_ENABLED || env.NEXT_PUBLIC_APPLE_ENABLED;
	if (!anyEnabled) return null;

	async function social(provider: "google" | "apple") {
		await signIn.social({ provider, callbackURL: next });
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-2">
				{env.NEXT_PUBLIC_GOOGLE_ENABLED && (
					<Button type="button" variant="outline" onClick={() => social("google")}>
						Continue with Google
					</Button>
				)}
				{env.NEXT_PUBLIC_APPLE_ENABLED && (
					<Button type="button" variant="outline" onClick={() => social("apple")}>
						Continue with Apple
					</Button>
				)}
			</div>
			<div className="flex items-center gap-3 text-xs text-muted-foreground">
				<span className="h-px flex-1 bg-border" />
				or
				<span className="h-px flex-1 bg-border" />
			</div>
		</div>
	);
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const isSignUp = mode === "sign-up";
	const nextParam = searchParams.get("next");
	const next = nextParam?.startsWith("/") ? nextParam : AFTER_AUTH;

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [agreedToTerms, setAgreedToTerms] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const pwError = isSignUp && password ? passwordError(password) : null;
	const confirmError =
		isSignUp && confirm && password !== confirm ? "Passwords don't match." : null;
	const score = passwordScore(password);
	const blockSignUp =
		isSignUp &&
		(pwError !== null || confirmError !== null || !password || !confirm || !name || !agreedToTerms);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (isSignUp) {
			const firstErr =
				(!name ? "Enter your name." : null) ||
				passwordError(password) ||
				(password !== confirm ? "Passwords don't match." : null) ||
				(!agreedToTerms ? "You must agree to the Terms of Service and Privacy Policy." : null);
			if (firstErr) {
				setError(firstErr);
				return;
			}
		}
		setPending(true);
		const result = isSignUp
			? await signUp.email({
					email,
					password,
					name,
					callbackURL: next,
					legalAcceptedVersion: LEGAL_VERSION,
					legalAcceptedAt: new Date(),
				})
			: await signIn.email({ email, password });
		setPending(false);
		if (result.error) {
			setError(result.error.message ?? "Something went wrong.");
			return;
		}
		router.push(next);
		router.refresh();
	}

	return (
		<div className="flex flex-col gap-5">
			<OAuthButtons next={next} />
			<form onSubmit={onSubmit} className="flex flex-col gap-4">
				{isSignUp && (
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="name">Name</Label>
						<Input
							id="name"
							name="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							autoComplete="name"
							required
						/>
					</div>
				)}
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						autoComplete="email"
						required
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center justify-between">
						<Label htmlFor="password">Password</Label>
						{!isSignUp && (
							<Link
								href="/forgot-password"
								className="text-xs text-muted-foreground hover:text-foreground hover:underline"
							>
								Forgot?
							</Link>
						)}
					</div>
					<Input
						id="password"
						name="password"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						autoComplete={isSignUp ? "new-password" : "current-password"}
						minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
						required
					/>
					{isSignUp && password && (
						<>
							<StrengthBar score={score} />
							{pwError ? (
								<span className="text-xs text-destructive">{pwError}</span>
							) : (
								<span className="text-xs text-muted-foreground">
									{STRENGTH_LABELS[score]} · at least {MIN_PASSWORD_LENGTH} characters
								</span>
							)}
						</>
					)}
				</div>
				{isSignUp && (
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="confirm">Confirm password</Label>
						<Input
							id="confirm"
							name="confirm"
							type="password"
							value={confirm}
							onChange={(e) => setConfirm(e.target.value)}
							autoComplete="new-password"
							required
						/>
						{confirmError && <span className="text-xs text-destructive">{confirmError}</span>}
					</div>
				)}
				{isSignUp && (
					<div className="flex items-start gap-2">
						<Checkbox
							id="agree-to-terms"
							className="mt-0.5"
							checked={agreedToTerms}
							onCheckedChange={(v) => setAgreedToTerms(v === true)}
							required
						/>
						<Label
							htmlFor="agree-to-terms"
							className="text-xs font-normal leading-relaxed text-muted-foreground"
						>
							I agree to the{" "}
							<Link href="/terms" target="_blank" className="underline underline-offset-2">
								Terms of Service
							</Link>{" "}
							and{" "}
							<Link href="/privacy" target="_blank" className="underline underline-offset-2">
								Privacy Policy
							</Link>
							.
						</Label>
					</div>
				)}
				{error && <p className="text-sm text-destructive">{error}</p>}
				<Button type="submit" disabled={pending || blockSignUp}>
					{pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
				</Button>
			</form>
			<p className="text-center text-sm text-muted-foreground">
				{isSignUp ? (
					<>
						Already have an account?{" "}
						<Link href="/sign-in" className="font-medium text-foreground hover:underline">
							Sign in
						</Link>
					</>
				) : (
					<>
						Need an account?{" "}
						<Link href="/sign-up" className="font-medium text-foreground hover:underline">
							Sign up
						</Link>
					</>
				)}
			</p>
		</div>
	);
}
