# CLI reference

The command-line tools used to operate an app built from this template, and the
commands you actually reach for. Agents: prefer these CLIs over dashboards where
a CLI path exists; the `provision-app` skill orchestrates them end-to-end.

Install (macOS): `brew install vercel-cli neonctl gh stripe/stripe-cli/stripe`;
`gcloud` via the Google Cloud SDK installer; `npm install -g cf` for Cloudflare.
Check with `--version`, or run `pnpm preflight` to check all of them (plus
Node/pnpm/Postgres/`.env`) at once.

## vercel — hosting, env, deploys
| Task | Command |
|------|---------|
| Link repo to a project | `vercel link` |
| List / add / pull env | `vercel env ls` · `vercel env add <NAME> <env>` · `vercel env pull .env.local` |
| Deploy | `vercel deploy` (preview) · `vercel deploy --prod` |
| Logs | `vercel logs <deployment-url>` |

Also available as session skills: `vercel:env`, `vercel:deploy`, `vercel:bootstrap`.

## neonctl — Postgres (preview/prod)
| Task | Command |
|------|---------|
| Login | `neonctl auth` |
| Create project | `neonctl projects create --name <app>` |
| Connection string | `neonctl connection-string --project-id <id> --database-name neondb` |
| Branch per env | `neonctl branches create --project-id <id> --name preview` |

## gcloud — Google Cloud (for Google OAuth project)
| Task | Command |
|------|---------|
| Create / select project | `gcloud projects create <id>` · `gcloud config set project <id>` |
| Auth | `gcloud auth login` |

> The OAuth **consent screen** and **client-ID** creation are Console UI, not gcloud.

## gh — GitHub (repo, CI secrets)
| Task | Command |
|------|---------|
| Create repo from cwd | `gh repo create <owner>/<app> --private --source . --push` |
| Set an Actions secret | `gh secret set <NAME>` |
| PRs / CI runs | `gh pr create` · `gh run list` · `gh run watch` |

## stripe — billing
| Task | Command |
|------|---------|
| Login | `stripe login` |
| Product / price | `stripe products create --name "<Plan>"` · `stripe prices create --product <id> --unit-amount 1000 --currency usd --recurring.interval month` |
| Local webhooks | `stripe listen --forward-to localhost:3000/api/webhooks/stripe` |
| Fire a test event | `stripe trigger checkout.session.completed` |

## cf — Cloudflare (DNS for a custom domain)
| Task | Command |
|------|---------|
| Login | `cf auth login` |
| Find your zone | `cf zones list --name <domain>` (or just pass `-z <domain>` below — it accepts a domain name, not only a zone ID) |
| List existing records | `cf dns records list -z <domain>` |
| Point a subdomain at Vercel | `cf dns records create -z <domain> --body '{"type":"CNAME","name":"app","content":"cname.vercel-dns.com","ttl":1,"proxied":false}'` |
| Point the apex at Vercel | `cf dns records create -z <domain> --body '{"type":"A","name":"@","content":"76.76.21.21","ttl":1,"proxied":false}'` |

Get the exact target (`vercel domains add <domain> <project>` prints it) before
creating the record — Vercel occasionally changes the anycast IP. Keep the
record **DNS only** (`proxied: false`, grey-cloud) so Vercel can issue/renew the
TLS cert directly; flip on the Cloudflare proxy only after `vercel domains
inspect <domain>` shows a valid configuration, and set Cloudflare's SSL/TLS mode
to Full (strict) if you do.

## Not a CLI, but agents should know
- **`/security-review`** — run before shipping (see `security.md`).
- **`openssl rand -base64 32`** — generate `BETTER_AUTH_SECRET` (unique per env).
