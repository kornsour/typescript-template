import { Card } from "@kornorg/design-system";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { BillingButton } from "@/components/billing-button";
import { SignOutButton } from "@/components/sign-out-button";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { isBillingEnabled } from "@/lib/stripe/client";

export const metadata: Metadata = { title: "Dashboard" };

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export default async function DashboardPage() {
	const user = await requireUser();

	const subs = isBillingEnabled
		? await db.select().from(subscription).where(eq(subscription.userId, user.id))
		: [];
	const activeSub = subs.find((s) => ACTIVE_STATUSES.has(s.status));

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
				<SignOutButton />
			</div>

			<Card className="p-6">
				<p className="text-sm text-muted-foreground">Signed in as</p>
				<p className="text-lg font-medium">{user.name}</p>
				<p className="text-sm text-muted-foreground">{user.email}</p>
				{!user.emailVerified && (
					<p className="mt-3 text-xs text-warning">
						Your email isn't verified yet — check your inbox (or the dev server console).
					</p>
				)}
			</Card>

			{isBillingEnabled && (
				<Card className="flex items-center justify-between p-6">
					<div>
						<p className="text-sm font-medium">Billing</p>
						<p className="text-sm text-muted-foreground">
							{activeSub ? `Plan active (${activeSub.status})` : "No active subscription"}
						</p>
					</div>
					<BillingButton hasSubscription={Boolean(activeSub)} />
				</Card>
			)}

			<p className="text-sm text-muted-foreground">
				This page is protected by <code className="font-mono">requireUser()</code>. Replace it with
				your app.
			</p>
		</div>
	);
}
