import { Button } from "@kornorg/design-system";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";

export default async function Home() {
	const session = await getSession();

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
			<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">TypeScript Template</h1>
			<p className="max-w-md text-lg text-muted-foreground">
				Next.js, Tailwind, Drizzle, better-auth (Google · Apple · email/password), and Stripe —
				ready to build on.
			</p>
			<div className="flex gap-3">
				{session ? (
					<Button asChild size="lg">
						<Link href="/dashboard">Go to dashboard</Link>
					</Button>
				) : (
					<>
						<Button asChild size="lg">
							<Link href="/sign-up">Get started</Link>
						</Button>
						<Button asChild variant="outline" size="lg">
							<Link href="/sign-in">Sign in</Link>
						</Button>
					</>
				)}
			</div>
		</div>
	);
}
