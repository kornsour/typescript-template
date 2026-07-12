"use client";

import { Button } from "@kornorg/design-system";
import { useAction } from "next-safe-action/hooks";
import { createBillingPortalSession, createCheckoutSession } from "@/lib/stripe/actions";

/**
 * Renders an "Upgrade" (checkout) button, or "Manage billing" (portal) if the
 * user already has an active subscription. Only rendered when billing is
 * enabled (see the dashboard).
 */
export function BillingButton({ hasSubscription }: { hasSubscription: boolean }) {
	const redirectTo = (url?: string) => {
		if (url) window.location.href = url;
	};
	const checkout = useAction(createCheckoutSession, {
		onSuccess: ({ data }) => redirectTo(data?.url),
	});
	const portal = useAction(createBillingPortalSession, {
		onSuccess: ({ data }) => redirectTo(data?.url),
	});

	if (hasSubscription) {
		return (
			<Button type="button" disabled={portal.isPending} onClick={() => portal.execute({})}>
				{portal.isPending ? "Opening…" : "Manage billing"}
			</Button>
		);
	}
	return (
		<Button type="button" disabled={checkout.isPending} onClick={() => checkout.execute({})}>
			{checkout.isPending ? "Redirecting…" : "Upgrade"}
		</Button>
	);
}
