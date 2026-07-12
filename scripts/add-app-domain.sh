#!/usr/bin/env bash
#
# Attach a domain to this app's Vercel project and create the matching
# Cloudflare DNS record — unattended. Two modes:
#
#   Subdomain (default) — the zero-friction path. Points <app>.$APPS_DOMAIN at
#   the linked Vercel project with a CNAME. No new domain to buy or verify;
#   every app reuses one shared Cloudflare zone. This is the template default
#   (see docs/adr/0019-subdomain-default-domains.md).
#
#     APPS_DOMAIN=yourapps.dev scripts/add-app-domain.sh myapp
#     # → myapp.yourapps.dev
#
#   Apex (promote) — when an app graduates to its own marketed domain. Adds the
#   apex + www. Uses a CNAME at the apex (Cloudflare flattens it to A records),
#   so there's no hard-coded anycast IP to rot.
#
#     scripts/add-app-domain.sh --apex myapp.com
#
# Prereqs: `vercel link` already run in this dir; `vercel` and `cf` CLIs
# authenticated. Records are created DNS-only (proxied:false) so Vercel can
# issue the TLS cert; turn on Cloudflare's proxy afterward (SSL/TLS mode
# Full (strict)) if you want it. See docs/setup/deployment.md.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERCEL_CNAME_TARGET="cname.vercel-dns.com"

die() { echo "✗ $1" >&2; exit 1; }

for c in vercel cf; do
	command -v "$c" >/dev/null 2>&1 || die "$c CLI not found (see docs/cli-reference.md)."
done

# Resolve the linked Vercel project name so `vercel domains add` targets it.
PROJECT=""
if [ -f .vercel/project.json ]; then
	PROJECT="$(node -p "require('./.vercel/project.json').projectName || ''" 2>/dev/null || true)"
fi
[ -n "$PROJECT" ] || die "No linked Vercel project found — run 'vercel link' first."

# Create one DNS-only record if it doesn't already exist. Args: zone name type content
ensure_record() {
	local zone="$1" name="$2" type="$3" content="$4"
	local label="$name"; [ "$name" = "@" ] && label="$zone" || label="$name.$zone"
	if cf dns records list -z "$zone" 2>/dev/null | grep -qiE "[[:space:]]${label}[[:space:]]"; then
		echo "  ✓ DNS record for $label already exists — leaving it alone"
		return
	fi
	cf dns records create -z "$zone" \
		--body "{\"type\":\"$type\",\"name\":\"$name\",\"content\":\"$content\",\"ttl\":1,\"proxied\":false}" >/dev/null
	echo "  ✓ created $type $label → $content (DNS only)"
}

# Add a domain to the Vercel project, tolerating "already added".
vercel_add_domain() {
	local fqdn="$1"
	if vercel domains add "$fqdn" "$PROJECT" 2>&1 | tee /dev/stderr | grep -qi "already"; then
		echo "  ✓ $fqdn already on the project"
	fi
}

MODE="subdomain"
if [ "${1:-}" = "--apex" ]; then MODE="apex"; shift; fi
ARG="${1:-}"
[ -n "$ARG" ] || die "Usage: [APPS_DOMAIN=...] $0 <app>   |   $0 --apex <domain>"

if [ "$MODE" = "subdomain" ]; then
	[ -n "${APPS_DOMAIN:-}" ] || die "Set APPS_DOMAIN to your shared apps zone, e.g. APPS_DOMAIN=yourapps.dev"
	APP="$ARG"
	FQDN="$APP.$APPS_DOMAIN"
	echo "→ Subdomain: $FQDN → project '$PROJECT'"
	vercel_add_domain "$FQDN"
	ensure_record "$APPS_DOMAIN" "$APP" "CNAME" "$VERCEL_CNAME_TARGET"
	echo "→ Verifying (poll until valid): vercel domains inspect $FQDN"
	vercel domains inspect "$FQDN" || true
	echo "✓ $FQDN attached. Set NEXT_PUBLIC_APP_URL=https://$FQDN in Vercel."
else
	DOMAIN="$ARG"
	echo "→ Apex domain: $DOMAIN (+ www) → project '$PROJECT'"
	vercel_add_domain "$DOMAIN"
	vercel_add_domain "www.$DOMAIN"
	# CNAME at the apex; Cloudflare flattens it to A records automatically, so no
	# anycast IP is hard-coded here.
	ensure_record "$DOMAIN" "@" "CNAME" "$VERCEL_CNAME_TARGET"
	ensure_record "$DOMAIN" "www" "CNAME" "$VERCEL_CNAME_TARGET"
	echo "→ Verifying (poll until valid): vercel domains inspect $DOMAIN"
	vercel domains inspect "$DOMAIN" || true
	echo "✓ $DOMAIN attached. Set NEXT_PUBLIC_APP_URL=https://$DOMAIN in Vercel."
fi
