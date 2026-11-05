import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDoctor } from "../plugins/script-forge/lib/doctor.ts";
import { runScaffold } from "../plugins/script-forge/lib/scaffold.ts";
import type { Config } from "../plugins/script-forge/lib/config.ts";

const roots: string[] = [];

function temporaryRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "gt-doctor-"));
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
		expect(result.fails).toBe(0);
		expect(result.passes).toBeGreaterThan(0);
		expect(result.warns).toBeGreaterThan(0);
		expect(result.checks.some((check) => check.message.includes("ESLint config reachable"))).toBe(true);
	});

	test("fails when package.json is missing", () => {
		const root = temporaryRoot();
		const result = runDoctor({ projectDir: root, config: config(), homeDir: root });
		expect(result.fails).toBeGreaterThan(0);
		expect(result.checks.some((check) => check.level === "fail" && check.message.includes("package.json"))).toBe(true);
	});
});
