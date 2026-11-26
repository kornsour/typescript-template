import { execFileSync, spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Drives scripts/hooks/pre-commit-gate.sh with simulated hook input against a
 * throwaway repository with a worktree. A stub `pnpm` records where it ran and
 * fails in any checkout that holds a `fail-<script>` file.
 */

let base: string;
let main: string;
let worktree: string;
let log: string;
let path: string;

const git = (dir: string, ...args: string[]) => execFileSync("git", ["-C", dir, ...args]);

beforeAll(() => {
	base = realpathSync(mkdtempSync(join(tmpdir(), "gate-")));
	main = join(base, "main");
	worktree = join(main, ".claude/worktrees/feature");
	log = join(base, "pnpm.log");
	const hooks = join(main, "scripts/hooks");
	mkdirSync(hooks, { recursive: true });
	for (const file of ["pre-commit-gate.sh", "pre-commit-gate.mjs"]) {
		copyFileSync(resolve("scripts/hooks", file), join(hooks, file));
	}
	git(main, "init", "-q");
	git(main, "add", "-A");
	git(main, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "init");
	git(main, "worktree", "add", "-q", worktree);

	const bin = join(base, "bin");
	mkdirSync(bin);
	writeFileSync(
		join(bin, "pnpm"),
		`#!/bin/sh\necho "$1 $(pwd -P)" >> '${log}'\n[ ! -e "fail-$1" ]\n`,
	);
	chmodSync(join(bin, "pnpm"), 0o755);
	path = `${bin}${delimiter}${process.env.PATH}`;
});

afterAll(() => {
	rmSync(base, { recursive: true, force: true });
});

beforeEach(() => {
	for (const dir of [main, worktree]) {
		mkdirSync(join(dir, "node_modules"), { recursive: true });
		rmSync(join(dir, "fail-check"), { force: true });
		rmSync(join(dir, "fail-test"), { force: true });
	}
	rmSync(log, { force: true });
});

function gate(command: string, { cwd = main, PATH = path } = {}) {
	const result = spawnSync("bash", [join(main, "scripts/hooks/pre-commit-gate.sh")], {
		cwd: main,
		env: { ...process.env, PATH },
		input: JSON.stringify({ cwd, tool_input: { command } }),
		encoding: "utf8",
	});
	const runs = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [];
	return { status: result.status, stderr: result.stderr, runs };
}

const checked = (dir: string) => [`check ${dir}`, `test ${dir}`];

describe("pre-commit gate", () => {
	it.each([
		["git -C", () => gate(`git -C ${worktree} commit -m x`)],
		["a quoted git -C", () => gate(`git -C "${worktree}" -c a.b=c commit -m x`)],
		["the hook's cwd", () => gate("git commit -m x", { cwd: worktree })],
		["cd", () => gate(`cd ${worktree} && git add -A && git commit -m x`)],
		["a relative cd", () => gate("cd .claude/worktrees/feature; git commit -m x")],
		["a subdirectory", () => gate(`git -C ${worktree}/scripts commit -m x`)],
		[
			"a heredoc message",
			() => gate(`git -C ${worktree} commit -F - <<'EOF'\ncd /elsewhere\ngit commit\nEOF`),
		],
	])("checks the worktree targeted through %s", (_name, run) => {
		const result = run();
		expect(result.runs).toEqual(checked(worktree));
		expect(result.status).toBe(0);
	});

	it("checks the main checkout for a commit made there", () => {
		expect(gate("git commit -m x").runs).toEqual(checked(main));
	});

	it("checks every checkout committed by one command", () => {
		const result = gate(
			`git commit -m a && (cd ${worktree} && git commit -m b) && git commit -m c`,
		);
		expect(result.runs).toEqual([...checked(main), ...checked(worktree)]);
	});

	it.each(["check", "test"])("blocks a worktree commit when %s fails there", (script) => {
		writeFileSync(join(worktree, `fail-${script}`), "");
		const result = gate(`git -C ${worktree} commit -m x`);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain(`'pnpm ${script}' failed in ${worktree}`);
	});

	it("ignores failures in a checkout that is not being committed", () => {
		writeFileSync(join(main, "fail-check"), "");
		expect(gate(`git -C ${worktree} commit -m x`).status).toBe(0);
	});

	it.each([
		'bash -c "git commit -m x"',
		"timeout 60 git commit -m x",
		"git --no-pager commit -m x",
	])("still gates %s", (command) => {
		writeFileSync(join(main, "fail-check"), "");
		expect(gate(command).status).toBe(2);
	});

	it("checks this project for a commit in an unrelated directory", () => {
		expect(gate(`git -C ${base} commit -m x`).runs).toEqual(checked(main));
	});

	it.each(['git -C "$DIR" commit -m x', "cd /does/not/exist && git commit -m x"])(
		"blocks when the target is unknown: %s",
		(command) => {
			const result = gate(command);
			expect(result.status).toBe(2);
			expect(result.stderr).toContain("can't tell which directory");
			expect(result.runs).toEqual([]);
		},
	);

	it("reports missing dependencies as such", () => {
		rmSync(join(worktree, "node_modules"), { recursive: true });
		const result = gate(`git -C ${worktree} commit -m x`);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain(`dependencies are not installed in ${worktree}`);
	});

	it("reports a missing pnpm as such", () => {
		// A PATH holding only what the gate itself needs.
		const tools = join(base, "tools");
		mkdirSync(tools);
		for (const tool of ["bash", "cat", "dirname", "git"]) {
			const found = execFileSync("sh", ["-c", `command -v ${tool}`], { encoding: "utf8" });
			symlinkSync(found.trim(), join(tools, tool));
		}
		symlinkSync(process.execPath, join(tools, "node"));
		const result = gate(`git -C ${worktree} commit -m x`, { PATH: tools });
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("`pnpm` is not on PATH");
	});

	it("blocks if the gate itself cannot run", () => {
		const script = join(main, "scripts/hooks/pre-commit-gate.mjs");
		const source = readFileSync(script, "utf8");
		writeFileSync(script, "syntax error(");
		try {
			expect(gate("git commit -m x").status).toBe(2);
		} finally {
			writeFileSync(script, source);
		}
	});

	it.each(["ls", "git log --grep commit", "git -C /tmp status # then commit"])(
		"lets %s through without checking",
		(command) => {
			const result = gate(command);
			expect(result.status).toBe(0);
			expect(result.runs).toEqual([]);
		},
	);
});
