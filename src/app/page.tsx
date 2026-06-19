export default function Home() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
			<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">TypeScript Template</h1>
			<p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
				Next.js, Tailwind CSS, Biome, Vitest, and Drizzle ORM — ready to build on. Edit{" "}
				<code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm dark:bg-zinc-800">
					src/app/page.tsx
				</code>{" "}
				to get started.
			</p>
		</div>
	);
}
