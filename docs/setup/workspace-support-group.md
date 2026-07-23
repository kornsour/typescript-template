# Support email — Google Workspace group

Every app built from this template shares one Google Workspace (the template
owner's primary domain). Rather than exposing a personal address as the support
contact, each app gets a `support@<app-domain>` Google Group backed by a real
inbox. This doc covers the one-time org setup (already done) and the
per-app checklist an agent should walk through when provisioning a new app.

Scripts live in `scripts/add-workspace-domain.ts` and
`scripts/create-support-group.ts`, run via the `workflow_dispatch` workflows
`provision-workspace-domain.yml` and `provision-support-group.yml`. Both
authenticate with **keyless Workload Identity Federation** — GitHub Actions'
OIDC token is exchanged for a domain-wide-delegated Admin SDK access token via
IAM Credentials `signJwt`, with no service account key ever touching disk.

## Where the concrete values live

This repo is public, so environment-specific identifiers (GCP project, WIF
provider path, service-account email) are **not** written into the workflows or
docs. They live as repository **Actions variables** (Settings → Secrets and
variables → Actions → Variables), which the two workflows read via `vars.*`:

| Variable | What it is |
| --- | --- |
| `GCP_PROJECT_ID` | The GCP project that hosts the provisioner service account |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full WIF provider path (`projects/<number>/locations/global/workloadIdentityPools/<pool>/providers/<provider>`) |
| `WORKSPACE_SA_EMAIL` | The provisioner service-account email |

The same three variables also exist as **organization variables** (visibility:
all repositories) on the template owner's GitHub organization — a new app repo
created **inside that org** inherits them automatically and needs no setup.
The org's owner(s) must also be trusted by the GCP side: the WIF provider's
attribute condition and the service account's `principalSet` IAM bindings each
list the allowed `repository_owner` values, so adding a new org means extending
both (see the one-time setup below).

A repo generated under a **personal account** does *not* inherit org variables —
copy them from the template repo when provisioning a new app:

```bash
for v in GCP_PROJECT_ID GCP_WORKLOAD_IDENTITY_PROVIDER WORKSPACE_SA_EMAIL; do
  gh variable set "$v" --repo <owner>/<new-app> \
    --body "$(gh variable get "$v" --repo <owner>/<template-repo> --json value --jq .value)"
done
```

## One-time org setup (already done)

Done once for the shared GCP project / Workspace. Only redo if rotating
the service account or adding a second GitHub org/owner.

- GCP project `<GCP_PROJECT_ID>` (project number `<project-number>`); APIs enabled:
  `admin.googleapis.com`, `iamcredentials.googleapis.com`, `sts.googleapis.com`,
  `siteverification.googleapis.com`.
- Service account `<WORKSPACE_SA_EMAIL>` (note its OAuth2 Client ID for the
  delegation step below), no key ever generated.
- Workload Identity Pool + provider trusting GitHub's OIDC issuer for any repo
  owned by the template owner; the full provider path is the
  `GCP_WORKLOAD_IDENTITY_PROVIDER` variable:
  ```
  projects/<project-number>/locations/global/workloadIdentityPools/<pool>/providers/<provider>
  ```
  The provider's **attribute condition** allowlists the trusted owners, e.g.
  `assertion.repository_owner=='<owner>' || assertion.repository_owner=='<org>'`.
  To trust an additional org/owner, update it with
  `gcloud iam workload-identity-pools providers update-oidc <provider> --attribute-condition=...`
  **and** add the two IAM bindings below for the new owner's `principalSet`.
- IAM bindings on the service account, both scoped to
  `principalSet://iam.googleapis.com/projects/<project-number>/locations/global/workloadIdentityPools/<pool>/attribute.repository_owner/<github-owner>`:
  `roles/iam.workloadIdentityUser` and `roles/iam.serviceAccountTokenCreator`
  (the latter is what lets the workflow call `signJwt` for domain-wide delegation).
- Domain-wide delegation authorized in the Workspace Admin Console
  (Security → API Controls → Domain-wide Delegation) for the service account's
  OAuth2 Client ID, scopes (comma-separated on one entry):
  ```
  https://www.googleapis.com/auth/admin.directory.group,https://www.googleapis.com/auth/siteverification,https://www.googleapis.com/auth/admin.directory.domain
  ```

## Per-new-app checklist

Copy this into the new app's setup notes and check items off as you go. Steps
alternate between automated dispatches and manual Admin Console clicks — the
manual ones are manual for a real reason, noted inline.

```
- [ ] Get the domain-verification TXT token
      gh workflow run provision-workspace-domain.yml -f command=get-token -f domain=<domain> -f admin_email=<workspace-admin>
      gh run watch <run-id> — copy the "google-site-verification=..." value
- [ ] Add the TXT record at the domain's DNS provider (apex, name = domain itself)
- [ ] Wait for propagation: dig +short TXT <domain> @8.8.8.8
- [ ] Add the domain to the Workspace account
      gh workflow run provision-workspace-domain.yml -f command=add-only -f domain=<domain> -f admin_email=<workspace-admin>
      (adds the domain but leaves it UNVERIFIED — see "Known issues" below)
- [ ] MANUAL: admin.google.com → Account → Domains → find <domain> → Verify domain
      (Google re-checks the TXT record that's already live; flips verified -> true)
- [ ] MANUAL: admin.google.com → Account → Domains → <domain> → Activate Gmail
      Copy the MX value it shows (currently a single record: priority 1, smtp.google.com)
- [ ] Add that MX record at the domain's DNS provider (apex)
- [ ] MANUAL: admin.google.com → Apps → Google Workspace → Gmail → Authenticate email
      Select <domain>, generate a 2048-bit DKIM key, copy the record name + value
- [ ] Add the DKIM TXT record at the domain's DNS provider
      (name is usually "google._domainkey.<domain>"; split the value into
      two quoted DNS strings if it's over 255 characters — one TXT string
      is capped at 255 bytes)
- [ ] MANUAL: back in the Gmail authenticate-email flow, click Start authentication
- [ ] Confirm verified status before creating the group
      gh workflow run provision-workspace-domain.yml -f command=status -f domain=<domain> -f admin_email=<workspace-admin>
      (should show "verified": true)
- [ ] Create the support group
      gh workflow run provision-support-group.yml -f domain=<domain> -f admin_email=<workspace-admin>
```

## Known issues

- **`siteVerification.webResource.insert` (the `verify-add` command) returns a
  persistent `503 backendError`** for service-account / domain-wide-delegation
  callers. This is a real, currently-unresolved bug on Google's side, not
  something in this repo — see
  [googleapis/google-api-python-client#2598](https://github.com/googleapis/google-api-python-client/issues/2598)
  and this [Google Developer forum thread](https://discuss.google.dev/t/site-verification-api-503-backenderror-when-verifying-domain-via-service-account/187464).
  Multiple independent reports, same symptom, no fix as of 2026-07-07.
  **Workaround**: use `add-only` (calls `directory.domains.insert` directly,
  skipping the broken endpoint) and complete verification manually via the
  Admin Console — the TXT record is already in place, so it's a single click.
  If Google fixes the bug, `verify-add` should start working and this step
  can go back to being automated.
- **`domains.insert` succeeds even when the domain isn't verified yet** — it
  just adds the domain in an unverified state (confirmed via the `status`
  command: `"verified": false`). Attempting to create a group under an
  unverified domain fails with a misleading `404 Domain not found`, not a
  permissions error. Always confirm `"verified": true` via `status` before
  creating groups.
- **DKIM key generation has no public API** — confirmed via Google's own
  docs and community threads. It's an Admin Console-only action; there is no
  way to script the key generation itself, only applying the resulting DNS
  record once a human has generated it.

## Future automation ideas

- The DNS record creation steps (TXT, MX, DKIM) were applied by hand via the
  AWS CLI against Route53 during initial setup. If a given app's DNS also
  lives in Route53, these could be scripted and wired into
  `provision-workspace-domain.yml` the same way GCP access is: set up AWS's
  own GitHub OIDC federation (an IAM role trusting `token.actions.githubusercontent.com`,
  mirroring the GCP Workload Identity Pool above) so the workflow can call
  `aws route53 change-resource-record-sets` directly — no static AWS keys in
  CI either.
- Revisit the `verify-add` 503 periodically; Google may fix it, at which
  point the manual "Verify domain" console click in the checklist above can
  be replaced with the automated `verify-add` command.
