import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runScaffold } from "../plugins/script-forge/lib/scaffold.ts";
import type { Config } from "../plugins/script-forge/lib/config.ts";

const roots: string[] = [];

function temporaryRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "gt-scaffold-"));
	roots.push(root);
	return root;
}

afterAll(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

function config(overrides: Partial<Config> = {}): Config {
	return {
		defaultNamespace: "tools",
		scaffoldDirectory: "",
		scriptsDirectory: "scripts",
		localDirectory: "local",
		esLintConfigLocation: "",
		...overrides,
	};
}

function scaffold(target: string, overrides: Partial<Config> = {}, force = false) {
	return runScaffold({
		projectDir: target,
		targetDir: target,
		name: "smoke-test",
		config: config(overrides),
		homeDir: target,
		force,
		install: false,
		git: false,
		yes: true,
	});
}

describe("scaffold", () => {
	test("creates the template workspace and rewrites placeholders", () => {
		const root = temporaryRoot();
		const target = join(root, "workspace");
		const result = scaffold(target);

		expect(result.installStatus).toBe("skipped");
		expect(existsSync(join(target, "package.json"))).toBe(true);
		expect(existsSync(join(target, "eslint.tooling.js"))).toBe(true);
		expect(existsSync(join(target, "scripts", ".gitkeep"))).toBe(true);
		expect(existsSync(join(target, "local", "tmp", ".gitkeep"))).toBe(true);
		expect(existsSync(join(target, "local", "raw_data", ".gitkeep"))).toBe(true);

		const packageJson = readFileSync(join(target, "package.json"), "utf8");
		expect(packageJson).toContain("\"name\": \"smoke-test\"");
		expect(packageJson).toContain("--config ./eslint.tooling.js");

		const gitignore = readFileSync(join(target, ".gitignore"), "utf8");
		expect(gitignore).toContain("local/tmp/*");
		expect(gitignore).not.toContain("{{localDir}}");
	});

	test("refuses an existing workspace without --force", () => {
		const root = temporaryRoot();
		const target = join(root, "workspace");
		scaffold(target);
		expect(() => scaffold(target)).toThrow(/already scaffolded/);
	});

	test("overwrites template files with --force", () => {
		const root = temporaryRoot();
		const target = join(root, "workspace");
		scaffold(target);
		const result = scaffold(target, {}, true);
		expect(result.files).toContain("package.json");
	});

	test("honors custom directory names", () => {
		const root = temporaryRoot();
		const target = join(root, "workspace");
		scaffold(target, { scriptsDirectory: "tools/scripts", localDirectory: "var/scratch" });

		expect(existsSync(join(target, "tools", "scripts", ".gitkeep"))).toBe(true);
		expect(existsSync(join(target, "var", "scratch", "tmp", ".gitkeep"))).toBe(true);
		expect(existsSync(join(target, "scripts"))).toBe(false);
	});

	test("requires the consent flag", () => {
		const root = temporaryRoot();
		const target = join(root, "workspace");
		expect(() =>
			runScaffold({
				projectDir: target,
				targetDir: target,
				name: "smoke-test",
				config: config(),
				homeDir: target,
				force: false,
				install: false,
				git: false,
				yes: false,
			}),
		).toThrow(/--yes/);
	});
});
