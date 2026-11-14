import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import type { Config } from "../plugins/script-forge/lib/config.ts";
import { runScaffold } from "../plugins/script-forge/lib/scaffold.ts";

const roots: string[] = [];

function temporaryRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "gt-scaffold-"));
	roots.push(root);
	return root;
}

after(() => {
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

		assert.equal(result.installStatus, "skipped");
		assert.ok(existsSync(join(target, "package.json")));
		assert.ok(existsSync(join(target, "eslint.tooling.js")));
		assert.ok(existsSync(join(target, "scripts", ".gitkeep")));
		assert.ok(existsSync(join(target, "local", "tmp", ".gitkeep")));
		assert.ok(existsSync(join(target, "local", "raw_data", ".gitkeep")));
		assert.ok(existsSync(join(target, "tests", "smoke.test.ts")));

		const packageJson = readFileSync(join(target, "package.json"), "utf8");
		assert.ok(packageJson.includes("\"name\": \"smoke-test\""));
		assert.ok(packageJson.includes("--config ./eslint.tooling.js"));
		assert.ok(packageJson.includes("\"node\": \">=22.18.0\""));
		assert.ok(!packageJson.includes("bun"));

		const gitignore = readFileSync(join(target, ".gitignore"), "utf8");
		assert.ok(gitignore.includes("local/tmp/*"));
		assert.ok(gitignore.includes("local/state/"));
		assert.ok(!gitignore.includes("{{localDir}}"));
	});

	test("refuses an existing workspace without --force", () => {
		const root = temporaryRoot();
		const target = join(root, "workspace");
		scaffold(target);
		assert.throws(() => scaffold(target), /already scaffolded/);
	});

	test("overwrites template files with --force", () => {
		const root = temporaryRoot();
		const target = join(root, "workspace");
		scaffold(target);
		const result = scaffold(target, {}, true);
		assert.ok(result.files.includes("package.json"));
	});

	test("honors custom directory names", () => {
		const root = temporaryRoot();
		const target = join(root, "workspace");
		scaffold(target, { scriptsDirectory: "tools/scripts", localDirectory: "var/scratch" });

		assert.ok(existsSync(join(target, "tools", "scripts", ".gitkeep")));
		assert.ok(existsSync(join(target, "var", "scratch", "tmp", ".gitkeep")));
		assert.ok(!existsSync(join(target, "scripts")));
	});

	test("requires the consent flag", () => {
		const root = temporaryRoot();
		const target = join(root, "workspace");
		assert.throws(
			() =>
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
			/--yes/,
		);
	});
});
