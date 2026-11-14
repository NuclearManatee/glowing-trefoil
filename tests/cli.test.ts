import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
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

afterAll(() => {
	for (const directory of roots) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe("cli", () => {
	test("version prints the package version", () => {
		const home = temporaryRoot();
		const result = runCli(["version"], home);
		expect(result.status).toBe(0);
		expect(result.stdout.trim()).toBe("1.0.0");
	});

	test("help prints usage", () => {
		const home = temporaryRoot();
		const result = runCli(["help"], home);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Usage:");
		expect(result.stdout).toContain("install <cursor|opencode>");
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
		expect(result.status).toBe(0);
		const parsed = JSON.parse(result.stdout) as Record<string, { value: string; source: string }>;
		expect(parsed.defaultNamespace?.value).toBe("tools");
		expect(parsed.defaultNamespace?.source).toBe("default");
		expect(parsed.scriptsDirectory?.value).toBe("claudeScripts");
		expect(parsed.scriptsDirectory?.source).toBe("claude");
	});

	test("an unknown command exits 1", () => {
		const home = temporaryRoot();
		const result = runCli(["nope"], home);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("unknown command");
	});

	test("an unknown install target exits 1", () => {
		const home = temporaryRoot();
		const result = runCli(["install", "nope"], home);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("unknown install target");
	});

	test("scaffold refuses to write without --yes", () => {
		const home = temporaryRoot();
		const target = join(temporaryRoot(), "workspace");
		const result = runCli(["scaffold", "smoke", "--target", target], home);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("--yes");
		expect(existsSync(target)).toBe(false);
	});
});
