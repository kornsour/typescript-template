# Agent and infrastructure guide

## Source of truth

This public template deliberately does not name an organization's accounts,
domains, role ARNs, state buckets, or internal documentation location. When a
project is created from the template, record its organization-level IaC source
of truth in that project's private `PROJECT_CONTEXT.md`.

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
   Never add long-lived AWS keys to GitHub or application environment files.
4. Tag resources with `Application`, `Environment`, `Owner`, `ManagedBy`, and
   `Lifecycle`.

## Public configuration and secrets

- Public docs and examples must use placeholders such as `<AWS_ACCOUNT_ID>`,
  `<AWS_REGION>`, `<DEPLOY_ROLE_ARN>`, and `<STATE_KEY>`; never replace them
  with organization-specific values.
- Keep non-secret deployment configuration in the protected deployment
  environment's configuration variables. Keep credentials, database URLs,
  signing keys, and third-party tokens in that environment's encrypted secrets.
- GitHub Actions deployments must use OIDC, not `AWS_ACCESS_KEY_ID` or
  `AWS_SECRET_ACCESS_KEY`. An externally hosted application runtime that must
  call AWS directly is an explicit exception: use a narrowly scoped,
  rotatable credential stored only as a runtime secret, never in source,
  examples, GitHub Actions, or a public document.
- Document secret *names* and required scopes, never their values.

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
