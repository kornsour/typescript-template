#!/usr/bin/env bash
#
# CI guard: fails if docs/adr/ has a duplicate ADR number or a file missing
# from the index table in docs/adr/README.md. This is what let ADR-0022 exist
# twice — a new record copy-pasted the wrong number, and nothing checked that
# the index still described every file on disk.
#
# Usage: check-adr-index.sh
#
# See docs/adr/README.md.
set -euo pipefail

ADR_DIR="docs/adr"
INDEX="${ADR_DIR}/README.md"

fail=0

# --- Every NNNN-*.md file in docs/adr/ (excluding README.md itself). ---
files="$(find "$ADR_DIR" -maxdepth 1 -type f -name '[0-9][0-9][0-9][0-9]-*.md' -exec basename {} \; | sort)"

# --- Duplicate ADR numbers: two files sharing the same leading NNNN. ---
dupes="$(cut -c1-4 <<<"$files" | sort | uniq -d)"
if [[ -n "$dupes" ]]; then
	echo "❌ Duplicate ADR number(s):"
	while IFS= read -r n; do
		grep "^${n}-" <<<"$files" | sed "s/^/  - /"
	done <<<"$dupes"
	fail=1
fi

# --- Every file must appear as a link target in the index table. ---
while IFS= read -r f; do
	[[ -z "$f" ]] && continue
	if ! grep -qF "(./${f})" "$INDEX"; then
		echo "❌ ${ADR_DIR}/${f} is missing from the index table in ${INDEX}."
		fail=1
	fi
done <<<"$files"

# --- Every index link must point at a file that actually exists. ---
while IFS= read -r linked; do
	[[ -z "$linked" ]] && continue
	if [[ ! -f "${ADR_DIR}/${linked}" ]]; then
		echo "❌ ${INDEX} links to ${ADR_DIR}/${linked}, which does not exist."
		fail=1
	fi
done < <(grep -oE '\(\./[0-9]{4}-[a-z0-9-]+\.md\)' "$INDEX" | sed -E 's/^\(\.\///; s/\)$//')

if [[ "$fail" -ne 0 ]]; then
	echo
	echo "Each ADR number must identify exactly one record, and the index must" \
		"list every file. See ${INDEX}."
	exit 1
fi

echo "✓ ADR numbers are unique and the index lists every file."
