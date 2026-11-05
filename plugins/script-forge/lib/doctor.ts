import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Config } from "./config.ts";
import { normalizeSlashes, resolveEslintConfig, resolveWorkspaceDirs } from "./config.ts";
import { BUN_PIN, bunVersion, versionMismatch } from "./runtime.ts";

export type DoctorLevel = "pass" | "warn" | "fail";

export type DoctorCheck = {
	level: DoctorLevel;
	message: string;
};

export type DoctorResult = {
	target: string;
	checks: DoctorCheck[];
	passes: number;
	warns: number;
	fails: number;
	hasTypeScript: boolean;
};

export type DoctorOptions = {
	projectDir: string;
	config: Config;
	homeDir?: string;
};

const RUNTIME_DEPENDENCIES = ["zod"] as const;
const DEV_DEPENDENCIES = [
	"eslint",
	"@typescript-eslint/eslint-plugin",
	"@typescript-eslint/parser",
	"@stylistic/eslint-plugin",
	"eslint-plugin-unicorn",
	"typescript",
	"@types/bun",
] as const;

function readJson(path: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			return null;
		}
		return parsed as Record<string, unknown>;
	} catch {
		return null;
	}
}

function recordValue(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
	const value = record[key];
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function stringValue(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" ? value : undefined;
}

function installedVersion(projectDir: string, pkg: string): string | null {
	const packageJson = readJson(join(projectDir, "node_modules", pkg, "package.json"));
	if (packageJson === null) {
		return null;
	}
	return stringValue(packageJson, "version") ?? null;
}

function addCheck(checks: DoctorCheck[], level: DoctorLevel, message: string): void {
	checks.push({ level, message });
}

function declaredIn(record: Record<string, unknown> | null, pkg: string): boolean {
	if (record === null) {
		return false;
	}
	return record[pkg] !== undefined;
}

function hasTypeScript(projectDir: string, scriptsDir: string, localDir: string): boolean {
	const roots = [join(projectDir, scriptsDir), join(projectDir, localDir, "tmp")];
	for (const root of roots) {
		if (!existsSync(root)) {
			continue;
		}
		const entries = readdirSync(root, { recursive: true });
		for (const entry of entries) {
			if (String(entry).endsWith(".ts")) {
				return true;
			}
		}
	}
	return false;
}

export function runDoctor(options: DoctorOptions): DoctorResult {
	const { projectDir } = options;
	const homeDir = options.homeDir ?? homedir();
	const checks: DoctorCheck[] = [];
	const { scriptsDir, localDir } = resolveWorkspaceDirs(options.config);

	addCheck(checks, "pass", `Node runtime present (${process.versions.node})`);
	const nodeMajor = Number(process.versions.node.split(".")[0] ?? "0");
	if (nodeMajor < 22) {
		addCheck(checks, "fail", `Node ${process.versions.node} is too old — the CLI requires Node 22 or later`);
	}

	const bun = bunVersion();
	if (bun === null) {
		addCheck(checks, "fail", `Bun ${BUN_PIN} not found — install it from https://bun.sh before running workspace scripts`);
	} else if (versionMismatch(BUN_PIN, bun)) {
		addCheck(checks, "warn", `Bun ${bun} does not match the pinned ${BUN_PIN}`);
	} else {
		addCheck(checks, "pass", `Bun ${bun} matches the pinned ${BUN_PIN}`);
	}

	const packageJson = readJson(join(projectDir, "package.json"));
	if (packageJson === null) {
		addCheck(checks, "fail", "package.json missing or unparsable — is this a scaffolded workspace?");
	} else {
		addCheck(checks, "pass", "package.json present and valid JSON");
		const engines = recordValue(packageJson, "engines");
		const enginesBun = engines === null ? undefined : stringValue(engines, "bun");
		if (enginesBun === undefined) {
			addCheck(checks, "warn", `package.json has no engines.bun pin — expected ${BUN_PIN}`);
		} else if (versionMismatch(BUN_PIN, enginesBun)) {
			addCheck(checks, "warn", `engines.bun "${enginesBun}" does not match the pinned ${BUN_PIN}`);
		} else {
			addCheck(checks, "pass", `engines.bun pins ${enginesBun}`);
		}
	}

	const dependencies = packageJson === null ? null : recordValue(packageJson, "dependencies");
	const devDependencies = packageJson === null ? null : recordValue(packageJson, "devDependencies");
	const dependencyGroups: { label: string; declared: Record<string, unknown> | null; packages: readonly string[] }[] = [
		{ label: "dependency", declared: dependencies, packages: RUNTIME_DEPENDENCIES },
		{ label: "devDependency", declared: devDependencies, packages: DEV_DEPENDENCIES },
	];
	for (const group of dependencyGroups) {
		for (const pkg of group.packages) {
			if (!declaredIn(group.declared, pkg)) {
				addCheck(checks, "fail", `${group.label} missing from package.json: ${pkg}`);
				continue;
			}
			const version = installedVersion(projectDir, pkg);
			if (version === null) {
				addCheck(checks, "warn", `${pkg} declared but not installed — run \`bun install\``);
			} else {
				addCheck(checks, "pass", `${pkg} installed (${version})`);
			}
		}
	}

	addCheck(checks, "pass", ".env checked for presence only — contents are never read");
	if (existsSync(join(projectDir, ".env"))) {
		addCheck(checks, "pass", ".env present");
	} else {
		addCheck(checks, "warn", ".env not found — provide env vars via .env or the shell");
	}

	for (const dir of [scriptsDir, join(localDir, "tmp"), join(localDir, "raw_data")]) {
		if (existsSync(join(projectDir, dir))) {
			addCheck(checks, "pass", `${normalizeSlashes(dir)}/ exists`);
		} else {
			addCheck(checks, "warn", `${normalizeSlashes(dir)}/ missing — expected in a scaffolded workspace`);
		}
	}

	if (existsSync(join(projectDir, ".git"))) {
		addCheck(checks, "pass", "git repository initialized");
	} else {
		addCheck(checks, "warn", "not a git repository — run `git init` or scaffold again");
	}

	const eslintConfig = resolveEslintConfig(options.config, projectDir, homeDir);
	if (eslintConfig === null) {
		addCheck(
			checks,
			"fail",
			"ESLint config not found — run `glowing-trefoil scaffold --force --yes` or set esLintConfigLocation",
		);
	} else if (!existsSync(eslintConfig.path)) {
		const hint = eslintConfig.source === "configured" ? "fix esLintConfigLocation" : "run scaffold again";
		addCheck(checks, "fail", `ESLint config not found at ${normalizeSlashes(eslintConfig.path)} — ${hint}`);
	} else {
		addCheck(checks, "pass", `ESLint config reachable (${normalizeSlashes(eslintConfig.path)})`);
	}

	const passes = checks.filter((check) => check.level === "pass").length;
	const warns = checks.filter((check) => check.level === "warn").length;
	const fails = checks.filter((check) => check.level === "fail").length;

	return {
		target: projectDir,
		checks,
		passes,
		warns,
		fails,
		hasTypeScript: hasTypeScript(projectDir, scriptsDir, localDir),
	};
}

export function doctorSummary(result: DoctorResult): string {
	return `${result.passes} pass, ${result.warns} warn, ${result.fails} fail`;
}
