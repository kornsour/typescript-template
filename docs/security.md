# Security posture

The one-page summary of how this template defends itself, and the checklist to
run before shipping. Read alongside the ADRs it links.

## What's built in

| Area | Control | Where |
|------|---------|-------|
| SQL injection | Drizzle parameterizes every query. **Never** build SQL by string concatenation; if you must use `sql`, use its tagged-template placeholders, never interpolate user input. | `src/db/` |
| AuthN | better-auth: hashed passwords (scrypt), secure/httpOnly/sameSite session cookies, CSRF protection on auth routes. | `src/lib/auth.ts`, [ADR-0012](./adr/0012-auth-better-auth.md) |
| Password quality | Length ≥ 12 + common-password blocklist (NIST 800-63B), enforced on the form **and** server-side (`before` hook) — client checks can be bypassed. | `shared/src/password.ts`, `shared/src/auth.ts` |
| AuthZ | `requireUser()` in every protected page/action; the proxy cookie check is only an optimistic redirect, never the sole gate. | `src/lib/auth/session.ts`, `src/proxy.ts` |
| API routes | App JSON routes check the session themselves (`withApiSession()`, `private, no-store`). better-auth's CSRF protection covers only `/api/auth/*`, so a state-changing app route must verify the request origin itself. | `src/lib/auth/api-session.ts` |
| Mobile deep links | The auth server trusts the app's URL scheme as an origin; `exp://` (Expo Go, matches any Expo project) is trusted in development only. | `src/lib/auth/mobile.ts`, [setup](./setup/mobile.md) |
| Brute force | better-auth rate limiter enabled (stricter on auth paths). | `src/lib/auth.ts` |
| Transport / headers | HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. | `next.config.ts`, [ADR-0009](./adr/0009-security-headers.md) |
| XSS | Nonce-based CSP (strict in prod). | `src/proxy.ts`, [ADR-0014](./adr/0014-content-security-policy.md) |
| Webhooks | Stripe signature verified against the raw body before any DB write. | `src/app/api/webhooks/stripe/route.ts` |
| CSRF (actions) | Server actions are same-origin POSTs; `next-safe-action` validates input with Zod. | `src/lib/safe-action.ts` |
| Secrets | All env vars validated at the boundary; server secrets never reach the client bundle. | `src/env.ts`, [ADR-0006](./adr/0006-type-safe-env.md) |
| Secret leakage | `.gitignore` excludes `.env*` (only `.env.example` is committed). | `.gitignore` |
| Support-form abuse | Layered: honeypot (always on) → optional Cloudflare Turnstile (env-gated, free) → DB-backed sliding-window rate limits per IP hash (5/h) and per email (3/h). IPs stored only as salted SHA-256 hashes; accepted submissions are persisted to `support_request` as the audit trail the limiter counts against. | `src/lib/support/anti-spam.ts`, `docs/setup/turnstile.md` |
| Outbound email | SES hardening checklist: domain DKIM/SPF/DMARC, least-privilege `ses:SendEmail` IAM, suppression list + bounce/complaint metrics. | `docs/setup/aws-ses.md` |
| Mobile deep links | The app's scheme (`<scheme>://`) is a trusted redirect target, including for emailed password-reset and verification links requested with a deep-link `redirectTo`/`callbackURL`. Any installed app can claim a custom scheme and would receive the token if the user opened such a link. The starter app never requests one; before adding deep linking, switch to universal/app links or restrict these parameters. | `src/lib/auth/mobile.ts` |

## Pre-deploy checklist

1. `BETTER_AUTH_SECRET` is a fresh 32-byte random value per environment
   (`openssl rand -base64 32`) — never reuse the dev secret in prod.
2. `NEXT_PUBLIC_APP_URL` is the real HTTPS domain in prod (OAuth redirects and
   email links depend on it).
3. OAuth redirect URIs registered with Google/Apple match `<APP_URL>/api/auth/callback/<provider>`.
4. Stripe webhook endpoint added in the Stripe dashboard with a **production**
   signing secret (test-mode `whsec_` won't verify live events).
5. Email verification is required in production — confirm `AWS_REGION` is set and
   `EMAIL_FROM` is a verified SES identity so users can actually verify. Walk
   the SES hardening checklist in `docs/setup/aws-ses.md` (DKIM/SPF/DMARC,
   least-privilege IAM, bounce/complaint handling).
6. The public support form ships with honeypot + rate limiting; for a
   public-facing launch also set the free Turnstile keys
   (`docs/setup/turnstile.md`).
7. Tighten the CSP in `src/proxy.ts` to your real origins; drop what you don't use.
8. Run the **`/security-review`** skill on the diff before merging.
9. Neon: use a pooled connection string and restrict DB access; rotate on leak.
