# TypeScript Template

A batteries-included Next.js template with TypeScript, Tailwind CSS, Biome, Vitest, and Drizzle ORM (NeonDB).

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Fill in DATABASE_URL with your NeonDB connection string

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Stack

| Tool | Purpose |
|------|---------|
| [Next.js](https://nextjs.org) | React framework (App Router) |
| [Tailwind CSS](https://tailwindcss.com) | Utility-first CSS |
| [Biome](https://biomejs.dev) | Linter + formatter |
| [Vitest](https://vitest.dev) | Unit testing |
| [Drizzle ORM](https://orm.drizzle.team) | Type-safe SQL ORM |
| [NeonDB](https://neon.tech) | Serverless Postgres |

## Scripts

```bash
pnpm dev          # Dev server (Turbopack)
pnpm build        # Production build
pnpm check:fix    # Lint + format (auto-fix)
pnpm test         # Run tests
pnpm db:push      # Push schema to DB
pnpm db:generate  # Generate migration
pnpm db:migrate   # Run migrations
pnpm db:studio    # Drizzle Studio GUI
```

## Documentation

See [`docs/`](./docs) — the _why_ behind the stack and conventions lives in
[Architecture Decision Records](./docs/adr), and operational runbooks (e.g.
[lockfile recovery](./docs/maintenance/pnpm-lockfile.md)) in
[`docs/maintenance/`](./docs/maintenance).

> Uses pnpm pinned via `packageManager`. Run `corepack enable` once so your
> local pnpm matches the project ([ADR-0002](./docs/adr/0002-package-manager-pnpm-pinned.md)).
