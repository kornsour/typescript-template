# Cloudflare Turnstile (support-form anti-spam)

Turnstile is Cloudflare's free CAPTCHA alternative (invisible or one-click
challenges, no image puzzles). The template uses it on the **public support
form** (`/support`) as the third defense layer — the honeypot and DB-backed
rate limiting are always on and need no setup (see
`src/lib/support/anti-spam.ts` and `docs/security.md`).

It is entirely optional and **inert until its env vars are set**, like every
other integration in this template.

## Get keys (free, ~2 minutes)

There is no public API for creating Turnstile widgets on the free plan — use
the dashboard:

1. [Cloudflare dashboard](https://dash.cloudflare.com) → **Turnstile** →
   **Add widget**.
2. Widget name: your app. Hostnames: your production domain(s) — add
   `localhost` too if you want to exercise the real challenge in dev.
3. Widget mode: **Managed** (recommended — invisible for most humans).
4. Copy the **Site Key** (public) and **Secret Key**.

## Wire them in

```bash
# .env (local) — and mirror to Vercel for preview/production:
NEXT_PUBLIC_TURNSTILE_SITE_KEY="0x4AAA..."
TURNSTILE_SECRET_KEY="0x4AAA..."
```

```bash
vercel env add NEXT_PUBLIC_TURNSTILE_SITE_KEY production
vercel env add TURNSTILE_SECRET_KEY production
```

Both keys are needed for the feature to do anything useful: the site key
renders the widget (`src/components/turnstile-widget.tsx`), the secret key
makes the server action verify tokens (`src/lib/support/anti-spam.ts`).
Setting only the secret would reject every submission — don't.

## Testing keys

Cloudflare publishes fixed test keys that always pass/fail without a real
challenge — useful for local verification:

| Behavior            | Site key                   | Secret key                            |
| ------------------- | -------------------------- | ------------------------------------- |
| Always passes       | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` |
| Always blocks       | `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` |

## Notes

- The widget script is injected only on pages that render the form, and only
  when the site key is set — zero cost otherwise.
- CSP: `src/proxy.ts` already allows `https://challenges.cloudflare.com` in
  `script-src` and `frame-src`.
- E2E runs with Turnstile unset, so specs never need to solve a challenge.
