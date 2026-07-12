# ADR-0019: New apps default to a subdomain of one shared zone

- Status: Accepted
- Date: 2026-07-12

## Context

The first deploy of a new app needs a domain. Buying and verifying a dedicated
domain per app is real friction on the happy path: a registrar purchase, a new
Cloudflare zone, nameserver/verification waits — all before the app is even
reachable. Most apps generated from this template are prototypes or internal
tools that never need their own marketed domain; the handful that graduate to a
product do.

Options considered:

1. **A dedicated apex domain per app** — best for marketing each app, but pays
   the buy-and-verify cost every single time, including for throwaways.
2. **Subdomains of one shared zone for everything** — cheapest and zero-friction,
   but a permanent subdomain is a weak home for a product you want to market.
3. **Subdomain by default, promote to apex on demand** — a subdomain of one
   shared Cloudflare zone for the first deploy; a one-command path to a
   dedicated apex domain when an app earns it.

## Decision

Adopt option 3. New apps default to `‹app›.$APPS_DOMAIN`, a subdomain of a
single Cloudflare zone reused across the fleet. `scripts/add-app-domain.sh`
attaches it to the linked Vercel project and creates the DNS record unattended.
Promotion to a dedicated apex domain is the same script with `--apex`.

The apex path uses a **CNAME at the apex** (Cloudflare flattens it to A records)
rather than a hard-coded anycast IP, so Vercel changing its edge IPs can't rot a
generated record.

## Consequences

- First deploy never blocks on buying a domain; only apps that need marketing
  incur the cost of a dedicated one.
- One shared zone means one place to manage DNS for most apps, and one wildcard
  TLS story.
- The shared zone is a mild blast-radius concentration (its Cloudflare
  credentials can touch every app's subdomain) — acceptable for a personal
  fleet; revisit if apps span trust boundaries.
- A subdomain is visible in the URL as part of the shared zone. Apps that must
  not advertise that relationship should be promoted to an apex domain from the
  start.
- Records are created DNS-only (`proxied: false`) so Vercel issues the TLS cert;
  enabling Cloudflare's proxy afterward requires SSL/TLS mode Full (strict).
