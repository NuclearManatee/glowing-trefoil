// doctor-check.ts — deep environment check for Script Forge projects.
// Plain TypeScript, node builtins only (no dependencies): must run under bun
// even before the project has any deps installed. Prints plain [PASS]/[WARN]/
// [FAIL] lines (never ANSI) and exits 0 when healthy, 2 when problems found.
//
// SECURITY: .env is checked for PRESENCE only — never read as a file, never
// printed. Versions of installed packages are printed, never their contents.
//
// Usage: bun run doctor-check.ts [target-dir] [plugin-root] [eslint-config] [scripts-dir] [local-dir]
//   target-dir    project to check (default: current working directory)
//   plugin-root   plugin install dir (default: empty — the config check falls back to it)
//   eslint-config absolute path to the project's eslint config (default: the plugin asset; empty + no plugin-root skips)
//   scripts-dir   workspace-relative scripts directory (default: scripts)
//   local-dir     workspace-relative scratch root (default: local)
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DEP_GROUPS = {
	dependencies: ["zod"],
	devDependencies: [
		"eslint",
		"@typescript-eslint/eslint-plugin",
		"@typescript-eslint/parser",
		"@stylistic/eslint-plugin",
		"eslint-plugin-unicorn",
		"typescript",
		"@types/bun",
	],
} as const;

const [targetDir, pluginRoot, eslintConfigArg, scriptsDirArg, localDirArg] = process.argv.slice(2) as [
	string | undefined,
	string | undefined,
	string | undefined,
	string | undefined,
	string | undefined,
];
const projectDir = targetDir ?? process.cwd();

const stripTrailingSlash = (value: string): string => value.replace(/[\\/]+$/, "");
const display = (path: string): string => path.split("\\").join("/");

const scriptsDir = stripTrailingSlash(scriptsDirArg ?? "") || "scripts";
const localDir = stripTrailingSlash(localDirArg ?? "") || "local";
const eslintConfig = eslintConfigArg !== undefined && eslintConfigArg !== "" ? eslintConfigArg : undefined;
const pluginConfig =
	pluginRoot !== undefined && pluginRoot !== "" ? join(pluginRoot, "skills", "anvil", "assets", "eslint.tooling.js") : undefined;
const effectiveConfig = eslintConfig ?? pluginConfig;

const REQUIRED_DIRS = [scriptsDir, join(localDir, "tmp"), join(localDir, "raw_data")];

let passes = 0;
let warns = 0;
let fails = 0;

function pass(message: string): void {
	passes++;
	console.log(`[PASS] ${message}`);
}

function warn(message: string): void {
	warns++;
	console.log(`[WARN] ${message}`);
}

function fail(message: string): void {
	fails++;
	console.log(`[FAIL] ${message}`);
}

function info(message: string): void {
	console.log(`[info] ${message}`);
}

function readJson(path: string): Record<string, unknown> | null {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function installedVersion(pkg: string): string | null {
	const pkgJson = readJson(join(projectDir, "node_modules", pkg, "package.json"));
	if (pkgJson === null) {
		return null;
	}
	return typeof pkgJson.version === "string" ? pkgJson.version : null;
}

function versionMismatch(enginesValue: unknown, actual: string): boolean {
	// engines.bun may be "1.3.14" or a semver range like ">=1.3.14"; compare
	// only the leading numeric triple — range operators are the project's
	// choice, mismatch is about the installed runtime line.
	const range = typeof enginesValue === "string" ? enginesValue.match(/(\d+)\.(\d+)\.(\d+)/) : null;
	if (range === null) {
		return false;
	}
	const want = range.slice(1, 4).join(".");
	return want !== actual.split("-")[0];
}

console.log(`Script Forge doctor — target: ${projectDir}`);
console.log("---");

// 1. package.json + engines.bun.
const packageJson = readJson(join(projectDir, "package.json"));
if (packageJson === null) {
	fail("package.json missing or unparsable — is this a scaffolded workspace?");
} else {
	pass("package.json present and valid JSON");
	const { engines } = packageJson;
	const enginesBun = typeof engines === "object" && engines !== null ? (engines as Record<string, unknown>).bun : undefined;
	if (enginesBun === undefined) {
		warn("package.json has no engines.bun pin — add one (e.g. \"engines\": { \"bun\": \"1.3.14\" })");
	} else {
		pass("engines.bun pinned");
	}
}

// 2. Bun runtime vs engines.bun.
const bunVersion = typeof Bun !== "undefined" ? Bun.version : process.env.BUN_VERSION ?? "unknown";
pass(`Bun runtime present (${bunVersion})`);
if (packageJson !== null) {
	const { engines } = packageJson;
	const enginesBun = typeof engines === "object" && engines !== null ? (engines as Record<string, unknown>).bun : undefined;
	if (enginesBun !== undefined && versionMismatch(enginesBun, bunVersion)) {
		warn(`installed Bun ${bunVersion} does not satisfy engines.bun "${String(enginesBun)}"`);
	}
}

// 3. Installed dependencies. Two groups: runtime must-haves and the eslint
// dev-dep group from the rulebook Tech Stack.
for (const [group, pkgs] of Object.entries(DEP_GROUPS)) {
	for (const pkg of pkgs) {
		const version = installedVersion(pkg);
		if (version === null) {
			fail(`${group} missing: ${pkg} — run \`bun add${group === "devDependencies" ? " -d" : ""} ${pkg}\``);
		} else {
			pass(`${pkg} installed (${version})`);
		}
	}
}

// 4. .env presence — never content. The rulebook's Never-Read-.env principle
// forbids reading it; this check only notes whether one exists at all.
info(".env checked for presence only — its contents are never read");
if (existsSync(join(projectDir, ".env"))) {
	pass(".env present");
} else {
	warn(".env not found — provide env vars via .env or the shell");
}

// 5. Folder layout.
for (const dir of REQUIRED_DIRS) {
	if (existsSync(join(projectDir, dir))) {
		pass(`${dir}/ exists`);
	} else {
		warn(`${dir}/ missing — expected in a scaffolded workspace`);
	}
}

// 6. Git.
if (existsSync(join(projectDir, ".git"))) {
	pass("git repository initialized");
} else {
	warn("not a git repository — run `git init` (or the scaffold command)");
}

// 7. ESLint config reachability — from esLintConfigLocation when given, else
// the plugin asset when a plugin root was passed in.
if (effectiveConfig !== undefined) {
	if (existsSync(effectiveConfig)) {
		pass(`eslint config reachable (${display(effectiveConfig)})`);
	} else {
		const hint = eslintConfig !== undefined ? "fix esLintConfigLocation" : "reinstall the plugin";
		fail(`eslint config not found at ${display(effectiveConfig)} — ${hint}`);
	}
}

const hasTsFiles = [scriptsDir, join(localDir, "tmp")].some((dir) => {
	const abs = join(projectDir, dir);
	if (!existsSync(abs)) {
		return false;
	}
	return readdirSync(abs, { recursive: true }).some((entry) => String(entry).endsWith(".ts"));
});
info(hasTsFiles ? "TypeScript sources found — lint with `bun run lint`" : "no TypeScript sources yet — nothing to lint or typecheck");

console.log("---");
console.log(`SUMMARY: ${passes} pass, ${warns} warn, ${fails} fail`);
process.exit(fails > 0 ? 2 : 0);
