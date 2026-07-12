/**
 * Pre-paint theme initialization.
 *
 * The design system's dark tokens switch on a `.dark` class on <html>
 * (@kornorg/design-system). This tiny script sets that class from the OS
 * preference before first paint, so there's no flash and no automatic-dark
 * regression when adopting the class-based theme.
 *
 * It ships as a static inline <script> in the root layout, allowlisted in the
 * CSP by its **hash** (`THEME_INIT_CSP_HASH`) rather than a per-request nonce.
 * A hash keeps the root layout fully static — reading a nonce via `headers()`
 * would opt every route (including the static legal pages) into dynamic
 * rendering. The hash must equal the SHA-256 (base64) of `THEME_INIT` exactly;
 * `theme-init.test.ts` fails CI if they ever drift.
 */
export const THEME_INIT =
	'(function(){try{var m=window.matchMedia("(prefers-color-scheme: dark)");var a=function(){document.documentElement.classList.toggle("dark",m.matches)};a();m.addEventListener("change",a)}catch(e){}})()';

/** SHA-256 (base64) of THEME_INIT. Regenerate with theme-init.test.ts if the script changes. */
export const THEME_INIT_CSP_HASH = "sha256-cZtJ0BRSR4xYnrrQMhWe9gJCzvatzIc6Q8pxYowHzE4=";
