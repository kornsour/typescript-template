import { Card } from "@kornorg/design-system";
import type { Metadata } from "next";
import Link from "next/link";
import { SupportForm } from "@/components/support-form";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Support" };

// Reads the session to prefill name/email, which makes this route dynamic — and
// keeps the form in the server-rendered HTML. Public: reachable signed in or out.
export default async function SupportPage() {
	const session = await getSession();
	const user = session?.user;

	return (
		<div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-16">
			<Link
				href="/"
				className="mb-8 text-sm text-muted-foreground hover:text-foreground hover:underline"
			>
				← Back home
			</Link>
			<Card className="p-6 sm:p-8">
				<SupportForm defaultName={user?.name ?? ""} defaultEmail={user?.email ?? ""} />
			</Card>
		</div>
	);
}
