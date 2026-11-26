#!/usr/bin/env bash
#
# Claude Code PreToolUse hook: block `git commit` unless lint + unit tests pass
# in the checkout being committed. Wired in .claude/settings.json. Receives the
# tool-call JSON on stdin; exits 2 to block the commit (stderr is shown to the
# agent), 0 to allow. The logic is in pre-commit-gate.mjs.
#
set -euo pipefail

INPUT="$(cat)"

# Fast path: this hook matches *every* Bash call, but only commits are gated, so
# bail before paying for a cold Node start. "commit" survives JSON escaping, and
# this is a deliberate superset of the real check — a non-commit command that
# merely mentions the word costs one wasted parse, never a skipped gate.
case "$INPUT" in
	*commit*) ;;
	*) exit 0 ;;
esac

# Only exit code 2 blocks a tool call, so any other failure (no Node, a crash in
# the script) must become 2 or the commit would go through unchecked.
printf '%s' "$INPUT" | node "$(dirname "${BASH_SOURCE[0]}")/pre-commit-gate.mjs" || exit 2
