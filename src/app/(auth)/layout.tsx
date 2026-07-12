import { Card } from "@kornorg/design-system";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex flex-1 items-center justify-center px-6 py-16">
			<Card className="w-full max-w-sm p-8">{children}</Card>
		</div>
	);
}
