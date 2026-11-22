# ADR-0025: TypeScript 7 (native compiler)

- Status: Accepted
- Date: 2026-11-21

## Context

TypeScript 7 is the Go port of the compiler (`tsc` is a native binary shipped
per platform as `@typescript/typescript-<os>-<arch>`). It is roughly an order of
magnitude faster than TypeScript 6, but it changes two things that matter to a
template other repos are cut from:

1. **No JavaScript compiler API.** `require("typescript")` on 7.x returns only
   `{ version, versionMajorMinor }`. Any tool that calls `ts.createProgram`,
   `ts.parseJsonConfigFileContent`, etc. breaks unless it detects 7 and falls
   back to the `@typescript/typescript6` compatibility package (which exposes
   the 6.x API and a `tsc6` binary).
2. **Stricter / changed `tsconfig` defaults** that 6.0 had only deprecated:
   `baseUrl` is gone, `paths` must be written relative to the tsconfig
   (`"./src/*"`), `compilerOptions.types` no longer auto-includes every
   `@types/*` package, and emitting builds need an explicit `rootDir`.

What in this template touches the compiler, checked against TS 7.0.2:

| Consumer | Uses the JS API? | Status on TS 7 |
| --- | --- | --- |
| `pnpm exec tsc --noEmit` (CI typecheck) | no — runs the binary | works |
| `next build` type-check step | no — Next 16.4 defaults `experimental.useTypeScriptCli: true` and spawns `tsc` | works; still fails the build on a type error |
| Vitest | no (Vite transform; `typecheck` mode not used) | works |
| Biome | no | works |
| Playwright | no (own transform) | works |
| drizzle-kit, SST | no (esbuild) | works |
| `@t3-oss/env-*` | peer dep only, types-only | works |
| Next's tsconfig editor plugin (`plugins: [{ name: "next" }]`) | TS-server plugin | ignored by the TS 7 language server; harmless, kept so a TS 6 editor setup still gets Next's hints |

## Decision

Use **`typescript@^7`** in the template. Do not add `@typescript/typescript6`
by default — nothing here needs the JS API. Keep these tsconfig conventions,
and keep them when deriving a new app:

- **No `baseUrl`.** Path aliases are tsconfig-relative: `"@/*": ["./src/*"]`.
- **List ambient type packages explicitly** in `compilerOptions.types`. The
  template sets `"types": ["node"]`; before this change `@types/node` was only
  loaded by accident, through a `/// <reference types="node" />` in Next's own
  `next/dist/types.d.ts`. If you add a package whose globals you rely on
  without importing it (e.g. Vitest globals, `@types/google.maps`), add it to
  `types` too.
- **`noEmit: true`** — Next/SWC compiles; `tsc` only type-checks. If a derived
  repo adds an emitting `tsconfig` (a library build, `declaration: true`), set
  `rootDir` explicitly; TS 7 no longer infers it from the input files.
- **No JS compiler API in repo code or scripts.** If a tool you add needs it
  (typescript-eslint, `ts-morph`, a dts bundler, Storybook docgen…), first check
  whether it already falls back to `@typescript/typescript6`; if not, install
  `@typescript/typescript6` and point that tool at it (pnpm `overrides` for
  `"<tool>>typescript": "npm:@typescript/typescript6@^6"`), rather than
  downgrading the project's `typescript`.

## Consequences

- `tsc --noEmit` and the type-check inside `next build` run on the native
  compiler (~0.5s for this repo).
- CI installs the platform binary through pnpm's optional dependencies; a
  `pnpm install --frozen-lockfile` on Linux runners picks
  `@typescript/typescript-linux-x64` from the same lockfile.
- Editors must use the TS 7 language server (VS Code: the workspace version);
  Next's TS-server plugin hints are not available there.
- A tool that silently requires the 6.x API will fail loudly on first use; the
  fix is the compatibility package, not pinning `typescript@6`.
