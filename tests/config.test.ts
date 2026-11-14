import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import {
	assertWorkspaceRelative,
	loadConfig,
	parseClaudeConfig,
	resolveEslintConfig,
	resolveScaffoldTarget,
} from "../plugins/script-forge/lib/config.ts";

const roots: string[] = [];

function temporaryRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "gt-config-"));
	roots.push(root);
	return root;
}

after(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("config resolution", () => {
	test("CLI beats project, Claude, global, and defaults", () => {
		const root = temporaryRoot();
		const project = join(root, "project");
		const home = join(root, "home");
		mkdirSync(project, { recursive: true });
		mkdirSync(join(home, ".config", "script-forge"), { recursive: true });
		writeFileSync(
			join(home, ".config", "script-forge", "config.json"),
			JSON.stringify({ defaultNamespace: "global", scriptsDirectory: "globalScripts" }),
		);
		writeFileSync(
			join(project, ".script-forge.json"),
			JSON.stringify({ defaultNamespace: "project", scriptsDirectory: "projectScripts" }),
		);

		const resolved = loadConfig({
			projectDir: project,
			homeDir: home,
			claude: { defaultNamespace: "claude" },
			cli: { defaultNamespace: "cli" },
		});

		assert.equal(resolved.values.defaultNamespace, "cli");
		assert.equal(resolved.values.scriptsDirectory, "projectScripts");
		assert.equal(resolved.sources.defaultNamespace, "cli");
		assert.equal(resolved.sources.scriptsDirectory, "project");
	});

	test("empty strings fall through to the next layer", () => {
		const root = temporaryRoot();
		const project = join(root, "project");
		mkdirSync(project, { recursive: true });

		const resolved = loadConfig({
			projectDir: project,
			homeDir: join(root, "home"),
			claude: { scriptsDirectory: "claudeScripts" },
			cli: { scriptsDirectory: "" },
		});

		assert.equal(resolved.values.scriptsDirectory, "claudeScripts");
	});

	test("defaults are complete", () => {
		const root = temporaryRoot();
		const resolved = loadConfig({ projectDir: root, homeDir: join(root, "home") });
		assert.deepEqual(resolved.values, {
			defaultNamespace: "tools",
			scaffoldDirectory: "",
			scriptsDirectory: "scripts",
			localDirectory: "local",
			esLintConfigLocation: "",
		});
	});

	test("invalid Claude config JSON is a user error", () => {
		assert.throws(() => parseClaudeConfig("{"));
	});
});

describe("path safety", () => {
	test("rejects parent escapes and absolute paths", () => {
		assert.throws(() => assertWorkspaceRelative("../outside", "scriptsDirectory"));
		assert.throws(() => assertWorkspaceRelative("C:/absolute", "scriptsDirectory"));
		assert.throws(() => assertWorkspaceRelative("/absolute", "scriptsDirectory"));
	});

	test("accepts nested workspace paths", () => {
		assert.equal(assertWorkspaceRelative("tools/scripts", "scriptsDirectory"), "tools/scripts");
	});

	test("scaffold target falls back to the project directory", () => {
		const root = temporaryRoot();
		assert.equal(resolveScaffoldTarget({ ...defaultConfig(), scaffoldDirectory: "" }, root, root), root);
	});

	test("project-local ESLint config is discovered", () => {
		const root = temporaryRoot();
		writeFileSync(join(root, "eslint.tooling.js"), "export default [];\n");
		const resolved = resolveEslintConfig(defaultConfig(), root, root);
		assert.equal(resolved?.source, "project");
		assert.equal(resolved?.path, join(root, "eslint.tooling.js"));
	});
});

function defaultConfig() {
	return {
		defaultNamespace: "tools",
		scaffoldDirectory: "",
		scriptsDirectory: "scripts",
		localDirectory: "local",
		esLintConfigLocation: "",
	};
}
