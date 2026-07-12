"use client";

import { Button } from "@kornorg/design-system";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
	const router = useRouter();
	const [pending, setPending] = useState(false);

	async function onClick() {
		setPending(true);
		await signOut();
		router.push("/sign-in");
		router.refresh();
	}

	return (
		<Button type="button" variant="outline" size="sm" onClick={onClick} disabled={pending}>
			{pending ? "Signing out…" : "Sign out"}
		</Button>
	);
}
