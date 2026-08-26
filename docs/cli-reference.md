# CLI reference

The command-line tools used to operate an app built from this template, and the
commands you actually reach for. Agents: prefer these CLIs over dashboards where
a CLI path exists; the `provision-app` skill orchestrates them end-to-end.

Install (macOS): `brew install neonctl gh stripe/stripe-cli/stripe awscli`;
`gcloud` via the Google Cloud SDK installer; `npm install -g cf` for
Cloudflare; `sst` ships as a dev dependency, invoke via `pnpm sst` / `npx sst`.
Check with `--version`, or run `pnpm preflight` to check all of them (plus
Node/pnpm/Postgres/`.env`) at once.

## sst — deploy (AWS via SST v4 + OpenNext)
| Task | Command |
|------|---------|
| Validate `sst.config.ts` | `pnpm sst:check` (runs `sst install`) |
| Deploy a stage | `pnpm sst deploy --stage production` |
| Set a secret | `npx sst secret set BetterAuthSecret "$(openssl rand -base64 32)" --stage production` |

`.github/workflows/deploy.yml` runs the production deploy on every push to
`main`. See [ADR-0023](./adr/0023-aws-sst-deploy.md) and
[`docs/setup/deployment.md`](./setup/deployment.md).

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

## cf — Cloudflare (DNS records SST doesn't manage)

The app's own hostname doesn't need this CLI: `sst.config.ts` provisions the
Cloudflare record (and the us-east-1 ACM cert) itself via
`sst.cloudflare.dns()` when `sst deploy` runs, given `CLOUDFLARE_API_TOKEN`
(scoped to `Zone:DNS:Edit`) and `CLOUDFLARE_ZONE_ID` — see
[ADR-0023](./adr/0023-aws-sst-deploy.md). Use `cf` directly for everything
SST doesn't touch: SES DKIM/SPF/DMARC records
([`docs/setup/aws-ses.md`](./setup/aws-ses.md)), domain-verification TXT
records, etc.

| Task | Command |
|------|---------|
| Login | `cf auth login` |
| Find your zone | `cf zones list --name <domain>` (or just pass `-z <domain>` below — it accepts a domain name, not only a zone ID) |
| List existing records | `cf dns records list -z <domain>` |
| Create a record | `cf dns records create -z <domain> --body '{"type":"TXT","name":"@","content":"...","ttl":1}'` |

## aws — Route53 (DNS for domains hosted there)
| Task | Command |
|------|---------|
| Identity check | `aws sts get-caller-identity` |
| Find a hosted zone | `aws route53 list-hosted-zones-by-name --dns-name <domain>` |
| List records | `aws route53 list-resource-record-sets --hosted-zone-id <zone-id>` |
| Upsert a record | `aws route53 change-resource-record-sets --hosted-zone-id <zone-id> --change-batch file://<path>.json` (see `docs/setup/workspace-support-group.md` for TXT/MX examples) |

No credentials are pre-configured — run `aws configure` (or `aws sso login`)
yourself; don't paste keys into an agent session. Prefer a scoped IAM
user/role over the account root credentials.

## Google Workspace — support@ groups, domain verification

Not a CLI — a pair of `gh workflow run` dispatches
(`provision-workspace-domain.yml`, `provision-support-group.yml`) that
authenticate via keyless Workload Identity Federation. Several steps require
manual Admin Console clicks (no public API exists for them). Full checklist:
[`docs/setup/workspace-support-group.md`](./setup/workspace-support-group.md).

## Not a CLI, but agents should know
- **`/security-review`** — run before shipping (see `security.md`).
- **`openssl rand -base64 32`** — generate `BETTER_AUTH_SECRET` (unique per env).
