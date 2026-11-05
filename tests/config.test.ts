import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

afterAll(() => {
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

		expect(resolved.values.defaultNamespace).toBe("cli");
		expect(resolved.values.scriptsDirectory).toBe("projectScripts");
		expect(resolved.sources.defaultNamespace).toBe("cli");
		expect(resolved.sources.scriptsDirectory).toBe("project");
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

		expect(resolved.values.scriptsDirectory).toBe("claudeScripts");
	});

	test("defaults are complete", () => {
		const root = temporaryRoot();
		const resolved = loadConfig({ projectDir: root, homeDir: join(root, "home") });
		expect(resolved.values).toEqual({
			defaultNamespace: "tools",
			scaffoldDirectory: "",
			scriptsDirectory: "scripts",
			localDirectory: "local",
			esLintConfigLocation: "",
		});
	});

	test("invalid Claude config JSON is a user error", () => {
		expect(() => parseClaudeConfig("{")).toThrow();
	});
});

describe("path safety", () => {
	test("rejects parent escapes and absolute paths", () => {
		expect(() => assertWorkspaceRelative("../outside", "scriptsDirectory")).toThrow();
		expect(() => assertWorkspaceRelative("C:/absolute", "scriptsDirectory")).toThrow();
		expect(() => assertWorkspaceRelative("/absolute", "scriptsDirectory")).toThrow();
	});

	test("accepts nested workspace paths", () => {
		expect(assertWorkspaceRelative("tools/scripts", "scriptsDirectory")).toBe("tools/scripts");
	});

	test("scaffold target falls back to the project directory", () => {
		const root = temporaryRoot();
		expect(resolveScaffoldTarget({ ...defaultConfig(), scaffoldDirectory: "" }, root, root)).toBe(root);
	});

	test("project-local ESLint config is discovered", () => {
		const root = temporaryRoot();
		writeFileSync(join(root, "eslint.tooling.js"), "export default [];\n");
		const resolved = resolveEslintConfig(defaultConfig(), root, root);
		expect(resolved?.source).toBe("project");
		expect(resolved?.path).toBe(join(root, "eslint.tooling.js"));
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
