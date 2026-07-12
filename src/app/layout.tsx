import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CookieBanner } from "@/components/cookie-banner";
import { SiteFooter } from "@/components/site-footer";
import { THEME_INIT } from "@/lib/theme-init";
// Design-system feel: tokens + compiled component styles + Geist faces. Swap
// this one import to restyle the whole app (e.g. `.../themes/cobalt.css`).
import "@kornorg/design-system/themes/modern-neutral.css";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: {
		default: "App",
		template: "%s · App",
	},
	description: "A Next.js application.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
			suppressHydrationWarning
		>
			<head>
				{/* Sets the `.dark` class before paint so the design system's class-based
				    dark tokens follow the OS preference with no flash. Static literal,
				    allowlisted in the CSP by hash (src/lib/theme-init.ts + proxy.ts) so the
				    layout stays static — no per-request nonce, no forced dynamic rendering. */}
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static literal, CSP-hash-allowlisted */}
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
			</head>
			<body className="min-h-full flex flex-col">
				{children}
				<SiteFooter />
				<CookieBanner />
			</body>
		</html>
	);
}
