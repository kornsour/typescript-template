# Agent and infrastructure guide

## Source of truth

The private organization-level source of truth is the
[Lurking Walrus IaC operating model](https://github.com/Lurking-Walrus/.github-private/blob/main/docs/IAC-OPERATING-MODEL.md).
It owns AWS account boundaries, Identity Center, organization guardrails, shared
domains, reusable modules, and the cross-project inventory. Membership is
required to read it.

This repository owns the infrastructure that deploys this application. Keep its
runtime resources, deployment workflow, state key, role ARN, environments, and
rollback procedure here. Do not place normal application resources in the
central organization repository.

## Before provisioning

1. Choose the runtime profile deliberately. A static profile has no database,
   authentication, server actions, runtime secrets, or schedules; anything
   else is a server profile.
2. Record the AWS account, regions, environments, state backend/key, deploy
   role, data classification, budget, and rollback target in this repository's
   `PROJECT_CONTEXT.md` before an apply.
3. Use GitHub OIDC with an exact repository and protected-environment trust.
   Never add long-lived AWS keys to GitHub, Vercel, or application environment
   files.
4. Tag resources with `Application`, `Environment`, `Owner`, `ManagedBy`, and
   `Lifecycle`.

Start small experiments in the shared Applications or Sandbox boundary. Request
a dedicated production account only for customer data, a material blast radius,
distinct cost/quotas, or a different security/retention requirement.

## Delivery rules

- Keep deployable OpenTofu/SST configuration under this repository's `infra/`
  directory once AWS infrastructure is introduced.
- A pull request must show the relevant plan and describe cost-bearing
  resources, secrets by name only, migration behavior, and rollback.
- Apply only from a protected deployment environment after review. Reconcile
  the resulting live state; a successful plan alone is not completion.
- Do not create accounts, DNS records, paid resources, production data changes,
  or public endpoints without explicit user authority.
- Prefer pay-per-use services. Treat NAT gateways, idle databases, public IPs,
  provisioned concurrency, and unbounded logs as explicit cost decisions.
