// The body of the pre-commit gate (see pre-commit-gate.sh). Works out which
// checkout each `git commit` in a shell command targets, then runs `pnpm check`
// and `pnpm test` there. The main checkout and its worktrees each have their own
// files, so checking any other directory would check the wrong code.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function block(message) {
	console.error(`❌ Pre-commit gate: ${message}`);
	process.exit(2);
}

/** Split a command into simple commands (word lists) and subshell brackets. */
function tokenize(command) {
	// Heredoc bodies are data (usually the commit message), not commands.
	const code = command.replace(
		/<<-?[ \t]*(["']?)([A-Za-z_]\w*)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2(?=\n|$)/g,
		"$3",
	);
	const tokens = [];
	let words = [];
	let word = null;
	let quote = null;
	const endWord = () => {
		if (word !== null) words.push(word);
		word = null;
	};
	const endCommand = () => {
		endWord();
		if (words.length) tokens.push(words);
		words = [];
	};
	for (let i = 0; i < code.length; i++) {
		const char = code[i];
		if (quote) {
			if (char === quote) quote = null;
			else if (char === "\\" && quote === '"' && '"\\$`'.includes(code[i + 1])) word += code[++i];
			else word += char;
		} else if (char === '"' || char === "'") {
			quote = char;
			word ??= "";
		} else if (char === "\\") {
			const next = code[++i] ?? "";
			if (next !== "\n") word = (word ?? "") + next;
		} else if (char === "#" && word === null) {
			while (i + 1 < code.length && code[i + 1] !== "\n") i++;
		} else if (char === " " || char === "\t") {
			endWord();
		} else if (";&|\n".includes(char)) {
			endCommand();
		} else if (char === "(" || char === ")") {
			endCommand();
			tokens.push(char);
		} else {
			word = (word ?? "") + char;
		}
	}
	endCommand();
	return tokens;
}

/** Resolve a path as the shell would, or null if that can't be done statically. */
function resolvePath(base, path) {
	if (base === null || path === undefined || path === "-" || /[$`*?]/.test(path)) return null;
	return resolve(base, path.replace(/^~(?=\/|$)/, homedir()));
}

/** The directory of every `git commit` in the command; null where unknown. */
function commitDirectories(command, cwd) {
	const found = [];
	const stack = [];
	let current = cwd;
	for (const words of tokenize(command)) {
		if (words === "(") {
			stack.push(current);
			continue;
		}
		if (words === ")") {
			current = stack.pop() ?? current;
			continue;
		}
		if (words[0] === "cd" || words[0] === "pushd") {
			const target = words.slice(1).find((w) => w !== "--" && !/^-[LPe]+$/.test(w));
			current = resolvePath(current, target ?? "~");
			continue;
		}
		// Anywhere in the command, so `timeout 60 git commit` is caught too.
		for (let i = 0; i < words.length; i++) {
			if (basename(words[i]) !== "git") continue;
			let dir = current;
			let j = i + 1;
			// Global options come before the subcommand.
			for (; words[j]?.startsWith("-"); j++) {
				const option = words[j];
				if (option === "-C" || option === "--work-tree") dir = resolvePath(dir, words[++j]);
				else if (option.startsWith("--work-tree=")) {
					dir = resolvePath(dir, option.slice("--work-tree=".length));
				} else if (["-c", "--git-dir", "--namespace", "--config-env"].includes(option)) j++;
			}
			if (words[j] === "commit") found.push(dir);
		}
	}
	return found;
}

function revParse(dir, flag) {
	const result = spawnSync("git", ["-C", dir, "rev-parse", flag], { encoding: "utf8" });
	return result.status === 0 ? result.stdout.trim() : null;
}

/** Identifies a repository; shared by its main checkout and every worktree. */
function repositoryOf(dir) {
	const common = revParse(dir, "--git-common-dir");
	return common === null ? null : realpathSync(resolve(dir, common));
}

/**
 * The checkout to verify for a commit made in `dir`: that checkout when it
 * belongs to this repository, otherwise this project.
 */
function checkoutFor(dir) {
	const top = revParse(dir, "--show-toplevel");
	return top !== null && repositoryOf(top) === repositoryOf(projectDir) ? top : projectDir;
}

function passes(root, script) {
	// Git sets these for its own subprocesses; they would point tests at the wrong repo.
	const { GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, ...env } = process.env;
	const result = spawnSync("pnpm", [script], { cwd: root, env, stdio: ["ignore", 2, 2] });
	if (result.error?.code === "ENOENT") {
		block(
			"`pnpm` is not on PATH, so nothing was checked. " +
				"Install it, e.g. `corepack enable --install-directory ~/.local/bin pnpm`.",
		);
	}
	return result.status === 0;
}

const input = JSON.parse(readFileSync(0, "utf8"));
const command = input.tool_input?.command ?? "";
const cwd = input.cwd || process.cwd();

const directories = commitDirectories(command, cwd);
// A commit hidden from the parser (e.g. inside `bash -c "…"`) is still gated.
if (directories.length === 0 && command.includes("git commit")) directories.push(cwd);
if (directories.length === 0) process.exit(0);

const roots = new Set();
for (const dir of directories) {
	if (dir === null || !existsSync(dir) || !statSync(dir).isDirectory()) {
		block(
			"can't tell which directory this commit targets. " +
				"Commit with a literal, existing path: `git -C /path/to/checkout commit …`.",
		);
	}
	roots.add(checkoutFor(dir));
}

for (const root of roots) {
	if (!existsSync(join(root, "node_modules"))) {
		block(
			`dependencies are not installed in ${root}, so nothing was checked. Run \`pnpm install\` there.`,
		);
	}
	console.error(`🔒 Pre-commit gate: running 'pnpm check' and 'pnpm test' in ${root}…`);
	if (!passes(root, "check")) block(`'pnpm check' failed in ${root} — see the output above.`);
	if (!passes(root, "test")) block(`'pnpm test' failed in ${root} — fix before committing.`);
}
console.error("✅ Pre-commit gate passed.");
