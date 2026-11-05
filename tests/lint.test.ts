import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "../plugins/script-forge/lib/config.ts";
import { runLint } from "../plugins/script-forge/lib/lint.ts";

const roots: string[] = [];

function temporaryRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "gt-lint-"));
	roots.push(root);
	return root;
}

afterAll(() => {
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

function baseOptions(projectDir: string) {
	return {
		projectDir,
		config: config(),
		homeDir: projectDir,
		fix: false,
		yes: false,
		extraArgs: [],
	};
}

describe("lint preconditions", () => {
	test("missing package.json is an environment error", () => {
		const root = temporaryRoot();
		expect(() => runLint(baseOptions(root))).toThrow(/package.json/);
	});

	test("missing ESLint config is an environment error with a fix", () => {
		const root = temporaryRoot();
		writeFileSync(join(root, "package.json"), "{}\n");
		expect(() => runLint(baseOptions(root))).toThrow(/ESLint config/);
	});

	test("missing ESLint install is an environment error", () => {
		const root = temporaryRoot();
		writeFileSync(join(root, "package.json"), "{}\n");
		writeFileSync(join(root, "eslint.tooling.js"), "export default [];\n");
		expect(() => runLint(baseOptions(root))).toThrow(/ESLint is not installed/);
	});

	test("--fix requires consent", () => {
		const root = temporaryRoot();
		writeFileSync(join(root, "package.json"), "{}\n");
		expect(() => runLint({ ...baseOptions(root), fix: true })).toThrow(/--yes/);
	});
});
