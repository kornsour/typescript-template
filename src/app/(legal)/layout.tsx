import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
			<Link
				href="/"
				className="mb-8 text-sm text-muted-foreground hover:text-foreground hover:underline"
			>
				← Back home
			</Link>
			<article className="legal-prose">{children}</article>
		</div>
	);
}
