#!/usr/bin/env bash
#
# Rebrand a fresh copy of this template to a new app name.
# Usage:  bash scripts/rename-app.sh <new-app-name>   (e.g. my-cool-app)
#
# Updates package.json name, the SST app name, the app title in the layout
# metadata, README, and the local dev DB name in .env(.example). Run once, right
# after copying the template. Review the diff afterward.
#
set -euo pipefail

NEW_NAME="${1:-}"
if [ -z "$NEW_NAME" ]; then
	echo "Usage: bash scripts/rename-app.sh <new-app-name>"
	exit 1
fi
if ! printf '%s' "$NEW_NAME" | grep -qE '^[a-z0-9][a-z0-9-]*$'; then
	echo "App name must be lowercase kebab-case (letters, digits, hyphens)."
	exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
DB_NAME="${NEW_NAME//-/_}_dev"
# "my-cool-app" -> "My Cool App"
TITLE="$(printf '%s' "$NEW_NAME" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++)$i=toupper(substr($i,1,1))substr($i,2)}1')"

node - "$NEW_NAME" "$DB_NAME" "$TITLE" <<'NODE'
const fs = require("fs");
const [, , name, dbName, title] = process.argv;

// package.json name
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.name = name;
fs.writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

// SST app name — must track package.json, since sst.config.ts cannot import it
// (SST rejects top-level imports there).
const sstConfig = "sst.config.ts";
if (fs.existsSync(sstConfig)) {
	let t = fs.readFileSync(sstConfig, "utf8");
	t = t.replace(/^const APP_NAME = ".*";$/m, `const APP_NAME = "${name}";`);
	fs.writeFileSync(sstConfig, t);
}

// layout metadata title
const layout = "src/app/layout.tsx";
if (fs.existsSync(layout)) {
	let t = fs.readFileSync(layout, "utf8");
	t = t.replace(/default: "App"/, `default: "${title}"`).replace(/template: "%s · App"/, `template: "%s · ${title}"`);
	fs.writeFileSync(layout, t);
}

// local dev DB name in env files
for (const p of [".env", ".env.example"]) {
	if (!fs.existsSync(p)) continue;
	let t = fs.readFileSync(p, "utf8");
	t = t.replace(/(localhost:5432\/)[a-z0-9_]+/g, `$1${dbName}`);
	fs.writeFileSync(p, t);
}
console.log(`✓ Renamed to "${name}" (title "${title}", db "${dbName}")`);
NODE

echo "Review the changes, then run:  pnpm bootstrap"
