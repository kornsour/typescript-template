#!/usr/bin/env bash
#
# Rebrand a fresh copy of this template to a new app name.
# Usage:  bash scripts/rename-app.sh <new-app-name> [--web-only] [--bundle-id <id>]
#   <new-app-name>    lowercase kebab-case, e.g. my-cool-app
#   --web-only        also delete the mobile app (scripts/remove-mobile.sh)
#   --bundle-id <id>  iOS bundle identifier and Android package, e.g.
#                     com.acme.coolapp (default: com.example.<name, no hyphens>)
#
# Updates package.json name, the SST app name, the app title (layout metadata,
# home heading and its e2e assertion, README heading), the local dev DB name in
# .env(.example), the mobile app identity in mobile/app.json, and APP_SCHEME in
# shared/src/app.ts. Run once, right after copying the template. Review the diff
# afterward.
#
set -euo pipefail

usage() {
	echo "Usage: bash scripts/rename-app.sh <new-app-name> [--web-only] [--bundle-id <id>]"
}
die() {
	echo "$1" >&2
	exit 1
}

NEW_NAME=""
BUNDLE_ID=""
WEB_ONLY=0
while [ $# -gt 0 ]; do
	case "$1" in
	--) ;; # `pnpm run` may forward a literal separator
	--web-only) WEB_ONLY=1 ;;
	--bundle-id)
		[ $# -ge 2 ] && [ -n "$2" ] || die "--bundle-id needs a value."
		BUNDLE_ID="$2"
		shift
		;;
	--bundle-id=*)
		BUNDLE_ID="${1#--bundle-id=}"
		[ -n "$BUNDLE_ID" ] || die "--bundle-id needs a value."
		;;
	-h | --help)
		usage
		exit 0
		;;
	-*) die "Unknown option: $1" ;;
	*)
		[ -z "$NEW_NAME" ] || die "Only one app name is allowed (got '$NEW_NAME' and '$1')."
		NEW_NAME="$1"
		;;
	esac
	shift
done

if [ -z "$NEW_NAME" ]; then
	usage
	exit 1
fi
# Matched in bash rather than with grep, which would accept any one good line of a
# multi-line value.
NAME_RE='^[a-z0-9][a-z0-9-]*$'
[[ "$NEW_NAME" =~ $NAME_RE ]] || die "App name must be lowercase kebab-case (letters, digits, hyphens)."

# One identifier serves both stores, so only what both accept is allowed: iOS
# rejects "_", Android rejects "-" and segments that start with a digit or are
# Java keywords.
JAVA_KEYWORDS=" abstract assert boolean break byte case catch char class const continue default do double else enum extends false final finally float for goto if implements import instanceof int interface long native new null package private protected public return short static strictfp super switch synchronized this throw throws transient true try void volatile while "
is_keyword() {
	case "$JAVA_KEYWORDS" in *" $1 "*) return 0 ;; *) return 1 ;; esac
}

if [ -n "$BUNDLE_ID" ]; then
	[ "$WEB_ONLY" = "0" ] || die "--bundle-id has no effect with --web-only; pass one or the other."
	ID_RE='^[A-Za-z][A-Za-z0-9]*([.][A-Za-z][A-Za-z0-9]*)+$'
	[[ "$BUNDLE_ID" =~ $ID_RE ]] ||
		die "Invalid --bundle-id '$BUNDLE_ID': use two or more dot-separated segments of letters and digits, each starting with a letter (e.g. com.acme.coolapp)."
	OLD_IFS="$IFS"
	IFS=.
	for segment in $BUNDLE_ID; do
		is_keyword "$segment" && die "Invalid --bundle-id '$BUNDLE_ID': '$segment' is a reserved Java keyword."
	done
	IFS="$OLD_IFS"
else
	segment="${NEW_NAME//-/}"
	if [[ "$segment" =~ ^[0-9] ]] || is_keyword "$segment"; then
		segment="app$segment"
	fi
	BUNDLE_ID="com.example.$segment"
fi

# A URI scheme must start with a letter too.
SCHEME="$NEW_NAME"
if [[ "$SCHEME" =~ ^[0-9] ]]; then
	SCHEME="app-$SCHEME"
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
DB_NAME="${NEW_NAME//-/_}_dev"
# "my-cool-app" -> "My Cool App"
TITLE="$(printf '%s' "$NEW_NAME" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++)$i=toupper(substr($i,1,1))substr($i,2)}1')"

node - "$NEW_NAME" "$DB_NAME" "$TITLE" "$SCHEME" "$BUNDLE_ID" <<'NODE'
const fs = require("fs");
const [, , name, dbName, title, scheme, bundleId] = process.argv;

// Applies [pattern, replacement] pairs to a file, if it exists.
const edit = (path, ...replacements) => {
	if (!fs.existsSync(path)) return;
	let t = fs.readFileSync(path, "utf8");
	for (const [pattern, replacement] of replacements) t = t.replace(pattern, replacement);
	fs.writeFileSync(path, t);
};

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

// Visible template title: home heading, the e2e spec asserting it, README H1.
edit("src/app/page.tsx", [
	/^(\t*)(<h1\b[^>\n]*>)TypeScript Template<\/h1>$/m,
	(_match, indent, open) => {
		const line = `${indent}${open}${title}</h1>`;
		// Wrap the way Biome would (tab = 2 columns, width 100) so check passes.
		if (line.length + indent.length <= 100) return line;
		return `${indent}${open}\n${indent}\t${title}\n${indent}</h1>`;
	},
]);
edit("e2e/home.spec.ts", [/name: "TypeScript Template"/, `name: "${title}"`]);
edit("README.md", [/^# TypeScript Template$/m, `# ${title}`]);

// Deep-link scheme trusted by the auth server; must equal expo.scheme below.
edit("shared/src/app.ts", [
	/^export const APP_SCHEME =\s*".*";$/m,
	// Wrapped the way Biome would when the line exceeds its width.
	scheme.length > 70
		? `export const APP_SCHEME =\n\t"${scheme}";`
		: `export const APP_SCHEME = "${scheme}";`,
]);

// Mobile app identity. Edited in place so the file keeps its formatting.
const appJson = "mobile/app.json";
if (fs.existsSync(appJson)) {
	const values = { name: title, slug: name, scheme, bundleIdentifier: bundleId, package: bundleId };
	edit(
		appJson,
		...Object.entries(values).map(([key, value]) => [
			new RegExp(`("${key}"\\s*:\\s*)"[^"]*"`),
			(_match, prefix) => `${prefix}${JSON.stringify(value)}`,
		]),
	);
	const { expo } = JSON.parse(fs.readFileSync(appJson, "utf8"));
	const wrong = Object.entries({
		"expo.name": [expo.name, title],
		"expo.slug": [expo.slug, name],
		"expo.scheme": [expo.scheme, scheme],
		"expo.ios.bundleIdentifier": [expo.ios?.bundleIdentifier, bundleId],
		"expo.android.package": [expo.android?.package, bundleId],
	}).filter(([, [actual, expected]]) => actual !== expected);
	if (wrong.length > 0) {
		console.error(`✗ Could not update ${wrong.map(([key]) => key).join(", ")} in ${appJson}`);
		process.exit(1);
	}
}

// local dev DB name in env files
for (const p of [".env", ".env.example"]) {
	if (!fs.existsSync(p)) continue;
	let t = fs.readFileSync(p, "utf8");
	t = t.replace(/(localhost:5432\/)[a-z0-9_]+/g, `$1${dbName}`);
	fs.writeFileSync(p, t);
}
console.log(`✓ Renamed to "${name}" (title "${title}", db "${dbName}")`);
if (fs.existsSync(appJson)) console.log(`  mobile: scheme "${scheme}", bundle id "${bundleId}"`);
NODE

if [ "$WEB_ONLY" = "1" ]; then
	bash scripts/remove-mobile.sh
fi

echo "Review the changes, then run:  pnpm bootstrap"
