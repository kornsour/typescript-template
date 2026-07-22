# AWS SES — setup & hardening

The template's pluggable email sender (`src/lib/email/index.ts`) sends via AWS
SES whenever `AWS_REGION` is set (credentials come from the SDK's default
provider chain — IAM role on Vercel/CI, `aws configure` profile locally).
This doc is the SES-side checklist: what to provision, and how to harden it so
a public app can't damage your sending reputation or your bill. Written to be
followed by an agent with the `aws` CLI, with console fallbacks where noted.

Throughout, `$DOMAIN` is the app's sending domain (e.g. `myapp.com`) and
`$AWS_REGION` matches the env var (e.g. `us-east-1`). SES is regional — verify
identities in the same region the app sends from.

## 1. Verify the sending domain (not just an address)

Verify the **domain** so any `noreply@`/`support@` address works and DKIM can
be aligned:

```bash
aws sesv2 create-email-identity --email-identity "$DOMAIN" --region "$AWS_REGION"
```

The response includes three **Easy DKIM** CNAME tokens. Publish each as DNS:

```
<token>._domainkey.$DOMAIN  CNAME  <token>.dkim.amazonses.com
```

(With Cloudflare DNS, the same `cf` CLI pattern `scripts/add-app-domain.sh`
uses can create these.) Check until `VerifiedForSendingStatus` is true:

```bash
aws sesv2 get-email-identity --email-identity "$DOMAIN" --region "$AWS_REGION" \
  --query '{verified: VerifiedForSendingStatus, dkim: DkimAttributes.Status}'
```

## 2. SPF + DMARC alignment (custom MAIL FROM)

By default SES uses `amazonses.com` as the envelope MAIL FROM, which fails
strict DMARC/SPF alignment. Set a custom MAIL FROM subdomain:

```bash
aws sesv2 put-email-identity-mail-from-attributes \
  --email-identity "$DOMAIN" \
  --mail-from-domain "mail.$DOMAIN" \
  --behavior-on-mx-failure USE_DEFAULT_VALUE \
  --region "$AWS_REGION"
```

Then publish DNS:

```
mail.$DOMAIN  MX   10 feedback-smtp.$AWS_REGION.amazonses.com
mail.$DOMAIN  TXT  "v=spf1 include:amazonses.com ~all"
```

And a DMARC policy on the root (start at `p=none`, tighten to `quarantine`
once reports look clean):

```
_dmarc.$DOMAIN  TXT  "v=DMARC1; p=none; rua=mailto:dmarc-reports@$DOMAIN"
```

## 3. Get out of the sandbox

New SES accounts are sandboxed: you can only send **to** verified addresses,
with tiny quotas. Production access is a support request (no charge):

```bash
aws sesv2 put-account-details \
  --production-access-enabled \
  --mail-type TRANSACTIONAL \
  --website-url "https://$DOMAIN" \
  --use-case-description "Transactional email for $DOMAIN: account email verification, password resets, and support-form delivery to our own support inbox. No marketing mail." \
  --region "$AWS_REGION"
```

AWS reviews it (typically <24h). Check status:

```bash
aws sesv2 get-account --region "$AWS_REGION" --query 'ProductionAccessEnabled'
```

Until approved, verify your own test inboxes as identities so dev/preview can
send to them.

## 4. Least-privilege IAM for the app

The app only ever calls `SendEmail`. Give its role/user exactly that, scoped
to the verified identity — nothing else (no `ses:*`, no identity management):

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": "ses:SendEmail",
			"Resource": "arn:aws:ses:$AWS_REGION:$ACCOUNT_ID:identity/$DOMAIN",
			"Condition": {
				"StringLike": { "ses:FromAddress": "*@$DOMAIN" }
			}
		}
	]
}
```

This means a leaked app credential can only send mail *as your domain from
your account* — bad, but contained: it can't verify new identities, raise
quotas, read account state, or send as anyone else. The app-side rate limiting
on the support form (`src/lib/support/anti-spam.ts`) bounds how fast the
public can make the app send.

## 5. Bounce & complaint handling (protects your reputation)

High bounce/complaint rates get SES accounts throttled or suspended. Two
cheap, console-free safeguards:

**Account-level suppression list** (auto-suppress addresses that bounce or
complain — usually on by default, make it explicit):

```bash
aws sesv2 put-account-suppression-attributes \
  --suppressed-reasons BOUNCE COMPLAINT --region "$AWS_REGION"
```

**A configuration set with CloudWatch event metrics**, and make it the
identity default so the app needs no code changes:

```bash
aws sesv2 create-configuration-set --configuration-set-name "$APP-default" --region "$AWS_REGION"
aws sesv2 create-configuration-set-event-destination \
  --configuration-set-name "$APP-default" \
  --event-destination-name cloudwatch-metrics \
  --event-destination '{"Enabled":true,"MatchingEventTypes":["SEND","DELIVERY","BOUNCE","COMPLAINT","REJECT"],"CloudWatchDestination":{"DimensionConfigurations":[{"DimensionName":"ses:configuration-set","DimensionValueSource":"MESSAGE_TAG","DefaultDimensionValue":"'"$APP-default"'"}]}}' \
  --region "$AWS_REGION"
aws sesv2 put-email-identity-configuration-set-attributes \
  --email-identity "$DOMAIN" \
  --configuration-set-name "$APP-default" \
  --region "$AWS_REGION"
```

Optionally add CloudWatch alarms on the `Bounce`/`Complaint` metrics (alert
well before SES's ~5% bounce / ~0.1% complaint danger zones). If you want
per-event detail (which address bounced), add an SNS event destination
instead/as well — that part is easiest in the console (SES → Configuration
sets → Event destinations).

## 6. Verify end to end

```bash
aws sesv2 send-email \
  --from-email-address "noreply@$DOMAIN" \
  --destination "ToAddresses=you@example.com" \
  --content '{"Simple":{"Subject":{"Data":"SES smoke test"},"Body":{"Text":{"Data":"It works."}}}}' \
  --region "$AWS_REGION"
```

Then check the received mail shows **DKIM: PASS, SPF: PASS, DMARC: PASS**
(Gmail: "Show original"). Finally set the app's env: `AWS_REGION` and
`EMAIL_FROM=noreply@$DOMAIN` (see `.env.example`), and confirm the deployed
runtime has credentials for the IAM principal from step 4.

## Console fallbacks

Everything above is also doable at **AWS Console → Amazon SES** in the target
region: *Verified identities* (steps 1–2), *Account dashboard → Request
production access* (step 3), *Configuration sets* (step 5). IAM policies live
in **IAM → Policies**.

## Reputation quick-reference

| Metric      | Comfortable | SES review risk |
| ----------- | ----------- | --------------- |
| Bounce rate | < 2%        | ≥ 5%            |
| Complaints  | < 0.05%     | ≥ 0.1%          |

Watch both at SES → Account dashboard, or the CloudWatch metrics from step 5.
