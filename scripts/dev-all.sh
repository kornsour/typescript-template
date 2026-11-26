#!/usr/bin/env bash
#
# Run the web dev server and the Expo dev server together (`pnpm dev:all`).
# Expo stays in the foreground because it is interactive (QR code, keypresses);
# the web server runs in the background, logging to the same terminal, and is
# stopped together with its child processes when this script exits. Extra
# arguments are passed to `expo start`.
#
# Must keep working with macOS's bash 3.2.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f mobile/package.json ]; then
	echo "No mobile/ app in this project — use 'pnpm dev'." >&2
	exit 1
fi

WEB_PID=""

cleanup() {
	status=$?
	trap - EXIT
	trap '' INT TERM HUP
	if [ -n "$WEB_PID" ]; then
		# A negative PID signals the whole process group: pnpm, Next, its workers.
		kill -TERM -- "-$WEB_PID" 2>/dev/null || true
		tries=0
		while kill -0 -- "-$WEB_PID" 2>/dev/null && [ "$tries" -lt 50 ]; do
			sleep 0.1
			tries=$((tries + 1))
		done
		kill -KILL -- "-$WEB_PID" 2>/dev/null || true
		wait "$WEB_PID" 2>/dev/null || true
	fi
	exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# Job control only while launching, so the web server leads its own process group
# (macOS has no `setsid`). That also keeps the terminal's Ctrl+C away from it;
# cleanup stops it instead. stdin is detached so it never competes with Expo.
set -m
# An explicit port makes Next fail when it is taken instead of moving to another
# one, which would leave the app talking to whatever else is on 3000.
pnpm dev -p 3000 </dev/null &
WEB_PID=$!
set +m

pnpm --dir mobile start ${1+"$@"}
