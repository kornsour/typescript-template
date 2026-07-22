"use client";

import { useEffect, useRef } from "react";
import { env } from "@/env";

/**
 * Minimal Cloudflare Turnstile widget — no npm dependency, rendered via the
 * explicit JS API. Only mount this when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set;
 * the api.js script is injected on first mount and reused after that. Script
 * injection is compatible with the strict CSP: our bundle is nonce-trusted, and
 * `'strict-dynamic'` propagates trust to scripts it creates (dev builds and
 * legacy browsers fall back to the challenges.cloudflare.com allowlist in
 * src/proxy.ts, which also allows the widget's iframe).
 *
 * Calls `onToken` with a fresh token on success and `null` when the token
 * expires or errors, so the form can gate its submit button.
 */

declare global {
	interface Window {
		turnstile?: {
			render: (
				el: HTMLElement,
				opts: {
					sitekey: string;
					callback: (token: string) => void;
					"expired-callback"?: () => void;
					"error-callback"?: () => void;
				},
			) => string;
			remove: (widgetId: string) => void;
		};
	}
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
	const containerRef = useRef<HTMLDivElement>(null);
	// Keep the latest callback without re-rendering the widget.
	const onTokenRef = useRef(onToken);
	onTokenRef.current = onToken;

	useEffect(() => {
		const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
		if (!siteKey || !containerRef.current) return;

		let widgetId: string | undefined;
		let cancelled = false;

		const render = () => {
			if (cancelled || !containerRef.current || !window.turnstile) return;
			widgetId = window.turnstile.render(containerRef.current, {
				sitekey: siteKey,
				callback: (token) => onTokenRef.current(token),
				"expired-callback": () => onTokenRef.current(null),
				"error-callback": () => onTokenRef.current(null),
			});
		};

		if (window.turnstile) {
			render();
		} else {
			let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
			if (!script) {
				script = document.createElement("script");
				script.src = SCRIPT_SRC;
				script.async = true;
				document.head.appendChild(script);
			}
			script.addEventListener("load", render);
		}

		return () => {
			cancelled = true;
			if (widgetId) window.turnstile?.remove(widgetId);
		};
	}, []);

	return <div ref={containerRef} />;
}
