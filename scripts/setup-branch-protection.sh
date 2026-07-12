#!/usr/bin/env bash
#
# Applies the canonical default-branch ruleset (.github/rulesets/default-branch.json)
# to a repo: a PR is required, and it can't merge until CI is green and the
# branch is up to date with the base (strict policy).
#
# A ruleset lives in repo *settings*, not repo *contents*, so a repo generated
# from this template does NOT inherit the template's — without this, a fresh app
# can merge to its default branch with CI red or not-yet-run. This codifies the
# gate so a new app gets it with one command (issue #60 item 4).
#
# Usage:
#   scripts/setup-branch-protection.sh                # infers owner/repo from `origin`
#   scripts/setup-branch-protection.sh <owner>/<repo>
#
# Requires the `gh` CLI, authenticated with admin on the repo. Idempotent:
# updates the existing "main" ruleset if one exists, otherwise creates it.
#
# Note: strict policy asks each PR to be up to date before merging. With batched
# Dependabot PRs + auto-merge this can require a rebase after each merge; enable
# the repo's "Automatically update branch" setting to have GitHub handle it, or
# drop `strict_required_status_checks_policy` to false in the ruleset JSON.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RULESET_FILE="$ROOT_DIR/.github/rulesets/default-branch.json"

if ! command -v gh >/dev/null 2>&1; then
	echo "✗ gh CLI not found. Install it: https://cli.github.com" >&2
	exit 1
fi
if [ ! -f "$RULESET_FILE" ]; then
	echo "✗ Ruleset file not found: $RULESET_FILE" >&2
	exit 1
fi

REPO="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
echo "→ Target repo: $REPO"

existing_id="$(gh api "repos/$REPO/rulesets" --jq '.[] | select(.name=="main") | .id' 2>/dev/null | head -n1 || true)"

if [ -n "$existing_id" ]; then
	echo "→ Updating existing ruleset ($existing_id)"
	gh api -X PUT "repos/$REPO/rulesets/$existing_id" --input "$RULESET_FILE" >/dev/null
else
	echo "→ Creating ruleset"
	gh api -X POST "repos/$REPO/rulesets" --input "$RULESET_FILE" >/dev/null
fi

echo "✓ Default-branch ruleset applied to $REPO (PR required + green CI, strict)."
