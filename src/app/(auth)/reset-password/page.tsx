import { ResetPasswordForm } from "@/components/reset-password-form";

// Reading `searchParams` makes this a dynamic server component, so the token is
// available at render time and the form ships in the initial HTML. A prior
// `"use client"` version read the token with `useSearchParams()`, which
// produced a client-only shell that paints blank under the production CSP.
export default async function ResetPasswordPage({
	searchParams,
}: {
	searchParams: Promise<{ token?: string }>;
}) {
	const { token } = await searchParams;
	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
			<ResetPasswordForm token={token ?? null} />
		</div>
	);
}
