# ADR-0020: UI on the @kornorg/design-system package

- Status: Accepted
- Date: 2026-07-12

## Context

The template's UI was hand-rolled Tailwind: ad-hoc `zinc-*` button/input classes
repeated across `auth-form`, `billing-button`, `sign-out-button`,
`cookie-banner`, and the pages, with a bespoke `--background/--foreground` token
pair and automatic dark mode via `prefers-color-scheme`. Every app generated
from the template then re-derived (and drifted) the same primitives.

`@kornorg/design-system` (published on npm) already provides those primitives —
`Button`, `Input`, `Label`, `Checkbox`, `Card`, … — plus a semantic token
vocabulary and interchangeable "feels" (Modern Neutral, Cobalt, Spartan), each a
self-contained stylesheet shipping compiled styles and the Geist faces.

## Decision

Depend on `@kornorg/design-system` and build the template's UI from it:

- Import one feel in `layout.tsx` (`themes/modern-neutral.css` by default); swap
  that single import to restyle the whole app.
- `globals.css` re-exposes the feel's tokens to the app's Tailwind via
  `@theme inline` so app-authored semantic utilities (`bg-card`,
  `text-muted-foreground`) compile, and repoints Tailwind's `dark:` variant at
  the design system's `.dark` class.
- Refactor components/pages off ad-hoc `zinc-*` classes onto the components and
  semantic tokens.

**Dark mode** becomes class-based (`.dark` on `<html>`) to match the design
system. A tiny inline theme-init script (`src/lib/theme-init.ts`) sets that class
from the OS preference before paint, preserving the previous automatic behavior
with no flash. It is allowlisted in the CSP by **hash**, not a per-request nonce,
so the root layout stays static — reading a nonce via `headers()` would opt every
route (including the static legal pages) into dynamic rendering. A unit test
keeps the hash in sync with the script.

## Consequences

- One source of truth for UI primitives across the fleet; restyling is a
  one-import change, and the feel can differ per app.
- New coupling: the template depends on the design-system package's release
  cadence and token contract. Dependabot tracks it like any other dependency.
- App markup should prefer semantic tokens (`bg-card`, `text-muted-foreground`,
  `border-border`, `text-destructive`) over raw palette classes so it tracks the
  active feel; a few state colors (password-strength bar) stay on the raw
  palette intentionally.
- The theme-init script is the one inline script; changing it requires updating
  `THEME_INIT_CSP_HASH` (the test enforces this).
