#!/usr/bin/env bash
#
# Convert the template to web-only (`pnpm mobile:remove`). One-way; commit first
# if you may want the mobile app back. Safe to re-run, e.g. after a failed
# `pnpm install`.
#
# Deletes mobile/ and everything that only serves it. shared/ and /api/me stay:
# the web app uses them. Docs prose is left for you to edit.
#
# Must keep working with macOS's bash 3.2.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

node <<'NODE'
const fs = require("fs");
const path = require("path");

// Every edit is computed and checked before anything is written or deleted, so a
// file in an unexpected shape leaves the project untouched.
const writes = [];
const deletes = ["mobile", "scripts/dev-all.sh"];
const fail = (message) => {
	console.error(`✗ ${message}\n  Nothing was changed.`);
	process.exit(1);
};
const edit = (file, transform) => {
	if (!fs.existsSync(file)) return;
	const before = fs.readFileSync(file, "utf8");
	const after = transform(before);
	if (after !== before) writes.push([file, after]);
};
const checkJson = (file, text) => {
	try {
		JSON.parse(text);
	} catch (error) {
		fail(`Editing ${file} would produce invalid JSON: ${error.message}`);
	}
	return text;
};

edit("package.json", (text) => {
	const pkg = JSON.parse(text);
	for (const name of ["dev:mobile", "dev:all", "mobile:check", "mobile:remove"]) {
		delete pkg.scripts?.[name];
	}
	return `${JSON.stringify(pkg, null, 2)}\n`;
});

edit("pnpm-workspace.yaml", (text) =>
	text.replace(/^[ \t]*-[ \t]*(["']?)mobile\1[ \t]*(#.*)?\r?\n/m, ""),
);

// Same export names as the real module, so src/lib/auth.ts needs no change.
const authModule = "src/lib/auth/mobile.ts";
edit(
	authModule,
	() => `/**
 * Web-only project: the mobile app was removed (scripts/remove-mobile.sh). These
 * empty lists keep src/lib/auth.ts unchanged.
 */
export const mobilePlugins = [] as const;

export const mobileTrustedOrigins: string[] = [];
`,
);

// Tests of the behaviour the stub no longer has.
const testFile = /\.test\.tsx?$/;
const walk = (dir) =>
	fs.existsSync(dir)
		? fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
				const full = path.join(dir, entry.name);
				return entry.isDirectory() ? walk(full) : [full];
			})
		: [];
for (const file of walk("src")) {
	if (!testFile.test(file)) continue;
	const isModuleTest = /^src[\\/]lib[\\/]auth[\\/]mobile\.test\.tsx?$/.test(file);
	if (isModuleTest) deletes.push(file);
}

// Blocks fenced by `# mobile:begin` / `# mobile:end` comment lines.
for (const file of [".github/workflows/ci.yml", ".github/dependabot.yml"]) {
	edit(file, (text) => {
		const kept = [];
		let inside = false;
		let removed = false;
		for (const line of text.split("\n")) {
			const marker = line.trim().match(/^# mobile:(begin|end)$/)?.[1];
			if (marker) {
				if ((marker === "begin") === inside) fail(`Unbalanced "# mobile:${marker}" in ${file}`);
				inside = marker === "begin";
				removed = true;
			} else if (!inside) {
				kept.push(line);
			}
		}
		if (inside) fail(`"# mobile:begin" without "# mobile:end" in ${file}`);
		return removed ? `${kept.join("\n").trimEnd()}\n` : text;
	});
}

// Text edits (not re-serialising) keep the hand-formatted JSON as it is.
const ruleset = ".github/rulesets/default-branch.json";
edit(ruleset, (text) => {
	const check = String.raw`\{[^{}]*"context"\s*:\s*"Mobile \(type check, tests\)"[^{}]*\}`;
	// First form: followed by a sibling. Second: last in the list.
	const after = text
		.replace(new RegExp(String.raw`${check}\s*,\s*`), "")
		.replace(new RegExp(String.raw`(\s*,)?\s*${check}`), "");
	return checkJson(ruleset, after);
});

edit("biome.json", (text) => {
	const after = text
		.replace(/^[ \t]*"!?mobile(\/[^"\n]*)?",?[ \t]*\r?\n/gm, "")
		.replace(/,(\s*\])/g, "$1");
	return after === text ? text : checkJson("biome.json", after);
});

// tsconfig.json may hold comments, so only the array entry itself is touched.
edit("tsconfig.json", (text) =>
	text.replace(/("exclude"\s*:\s*\[)([^\]]*)(\])/, (_match, open, body, close) => {
		const next = body.replace(/\s*,\s*"mobile"(?=\s*(,|$))/, "").replace(/"mobile"\s*,\s*/, "");
		return `${open}${next}${close}`;
	}),
);

for (const [file, text] of writes) {
	fs.writeFileSync(file, text);
	console.log(`  ✓ updated ${file}`);
}
for (const target of deletes) {
	if (!fs.existsSync(target)) continue;
	fs.rmSync(target, { recursive: true, force: true });
	console.log(`  ✓ deleted ${target}`);
}
NODE

echo "Updating the lockfile…"
# CI environments default to a frozen lockfile, which would refuse this change.
pnpm install --no-frozen-lockfile
# Biome puts a shortened array back on one line; do that so `pnpm check` passes.
[ ! -f biome.json ] || pnpm exec biome format --write biome.json

echo
echo "✓ This project is now web-only. Review the diff, then run:"
echo "    pnpm check && pnpm typecheck && pnpm test"
echo "Docs still describe the mobile app; edit or delete those passages as you like."
if [ -f .github/rulesets/default-branch.json ]; then
	echo "If branch protection was already applied on GitHub, re-apply it:"
	echo "    scripts/setup-branch-protection.sh <owner>/<repo>"
fi
