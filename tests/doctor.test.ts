import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import type { Config } from "../plugins/script-forge/lib/config.ts";
import { runDoctor } from "../plugins/script-forge/lib/doctor.ts";
import { runScaffold } from "../plugins/script-forge/lib/scaffold.ts";

const roots: string[] = [];

function temporaryRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "gt-doctor-"));
	roots.push(root);
	return root;
}

after(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

function config(): Config {
	return {
		defaultNamespace: "tools",
		scaffoldDirectory: "",
		scriptsDirectory: "scripts",
		localDirectory: "local",
		esLintConfigLocation: "",
	};
}

describe("doctor", () => {
	test("passes structural checks on a freshly scaffolded workspace", () => {
		const root = temporaryRoot();
		const target = join(root, "workspace");
		runScaffold({
			projectDir: target,
			targetDir: target,
			name: "doctor-test",
			config: config(),
			homeDir: target,
			force: false,
			install: false,
			git: false,
			yes: true,
		});

		const result = runDoctor({ projectDir: target, config: config(), homeDir: target });
		assert.equal(result.fails, 0);
		assert.ok(result.passes > 0);
		assert.ok(result.warns > 0);
		assert.ok(result.checks.some((check) => check.message.includes("ESLint config reachable")));
	});

	test("fails when package.json is missing", () => {
		const root = temporaryRoot();
		const result = runDoctor({ projectDir: root, config: config(), homeDir: root });
		assert.ok(result.fails > 0);
		assert.ok(result.checks.some((check) => check.level === "fail" && check.message.includes("package.json")));
	});
});
