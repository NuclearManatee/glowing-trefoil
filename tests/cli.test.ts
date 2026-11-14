import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";

const root = join(import.meta.dirname, "..");
const cliPath = join(root, "plugins", "script-forge", "cli", "index.ts");
const roots: string[] = [];

function temporaryRoot(): string {
	const directory = mkdtempSync(join(tmpdir(), "gt-cli-"));
	roots.push(directory);
	return directory;
}

function runCli(args: string[], homeDir: string, cwd: string = root) {
	const result = spawnSync(process.execPath, [cliPath, ...args], {
		cwd,
		encoding: "utf8",
		shell: false,
		env: {
			...process.env,
			HOME: homeDir,
			USERPROFILE: homeDir,
			NO_COLOR: "1",
		},
	});
	return {
		status: result.status,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

after(() => {
	for (const directory of roots) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe("cli", () => {
	test("version prints the package version", () => {
		const home = temporaryRoot();
		const result = runCli(["version"], home);
		assert.equal(result.status, 0);
		assert.equal(result.stdout.trim(), "1.0.0");
	});

	test("help prints usage", () => {
		const home = temporaryRoot();
		const result = runCli(["help"], home);
		assert.equal(result.status, 0);
		assert.ok(result.stdout.includes("Usage:"));
		assert.ok(result.stdout.includes("install <cursor|opencode>"));
	});

	test("config reports values and their source", () => {
		const home = temporaryRoot();
		const project = temporaryRoot();
		const result = runCli(
			[
				"config",
				"--json",
				"--project",
				project,
				"--claude-config-json",
				JSON.stringify({ scriptsDirectory: "claudeScripts" }),
			],
			home,
		);
		assert.equal(result.status, 0);
		const parsed = JSON.parse(result.stdout) as Record<string, { value: string; source: string }>;
		assert.equal(parsed.defaultNamespace?.value, "tools");
		assert.equal(parsed.defaultNamespace?.source, "default");
		assert.equal(parsed.scriptsDirectory?.value, "claudeScripts");
		assert.equal(parsed.scriptsDirectory?.source, "claude");
	});

	test("an unknown command exits 1", () => {
		const home = temporaryRoot();
		const result = runCli(["nope"], home);
		assert.equal(result.status, 1);
		assert.ok(result.stderr.includes("unknown command"));
	});

	test("an unknown install target exits 1", () => {
		const home = temporaryRoot();
		const result = runCli(["install", "nope"], home);
		assert.equal(result.status, 1);
		assert.ok(result.stderr.includes("unknown install target"));
	});

	test("scaffold refuses to write without --yes", () => {
		const home = temporaryRoot();
		const target = join(temporaryRoot(), "workspace");
		const result = runCli(["scaffold", "smoke", "--target", target], home);
		assert.equal(result.status, 1);
		assert.ok(result.stderr.includes("--yes"));
		assert.equal(existsSync(target), false);
	});
});
