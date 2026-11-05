#!/usr/bin/env node
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
	CONFIG_KEYS,
	formatConfig,
	loadConfig,
	normalizeSlashes,
	parseClaudeConfig,
	resolveScaffoldTarget,
	type ConfigKey,
	type ConfigLayer,
	type ResolvedConfig,
} from "../lib/config.ts";
import { doctorSummary, runDoctor, type DoctorLevel } from "../lib/doctor.ts";
import { CliError, EXIT_INTERNAL, EXIT_INTERRUPTED, EXIT_SUCCESS, userError } from "../lib/errors.ts";
import { installCursor, installOpenCode, uninstallCursor, uninstallOpenCode, type InstallTarget } from "../lib/install.ts";
import { runLint } from "../lib/lint.ts";
import { packageVersion } from "../lib/paths.ts";
import { runScaffold } from "../lib/scaffold.ts";

const CONFIG_OPTIONS: Record<string, ConfigKey> = {
	"--default-namespace": "defaultNamespace",
	"--scaffold-directory": "scaffoldDirectory",
	"--scripts-directory": "scriptsDirectory",
	"--local-directory": "localDirectory",
	"--eslint-config-location": "esLintConfigLocation",
};

const CONFIG_OPTION_NAMES = Object.keys(CONFIG_OPTIONS);

type ParsedArgs = {
	positionals: string[];
	flags: Set<string>;
	options: Map<string, string>;
	passthrough: string[];
};

function parseArgs(args: string[], optionNames: string[], flagNames: string[]): ParsedArgs {
	const positionals: string[] = [];
	const flags = new Set<string>();
	const options = new Map<string, string>();
	const passthrough: string[] = [];
	let index = 0;
	while (index < args.length) {
		const arg = args[index];
		if (arg === undefined) {
			break;
		}
		if (arg === "--") {
			passthrough.push(...args.slice(index + 1));
			break;
		}
		if (optionNames.includes(arg)) {
			const value = args[index + 1];
			if (value === undefined) {
				throw userError(`${arg} requires a value`);
			}
			options.set(arg, value);
			index += 2;
			continue;
		}
		if (flagNames.includes(arg)) {
			flags.add(arg);
			index += 1;
			continue;
		}
		if (arg.startsWith("--")) {
			throw userError(`unknown option: ${arg}`);
		}
		positionals.push(arg);
		index += 1;
	}
	return { positionals, flags, options, passthrough };
}

function configLayerFromOptions(parsed: ParsedArgs): ConfigLayer {
	const layer: ConfigLayer = {};
	for (const optionName of CONFIG_OPTION_NAMES) {
		const value = parsed.options.get(optionName);
		if (value !== undefined) {
			const key = CONFIG_OPTIONS[optionName];
			if (key !== undefined) {
				layer[key] = value;
			}
		}
	}
	return layer;
}

function resolveConfig(parsed: ParsedArgs, projectDir: string): ResolvedConfig {
	const claudeRaw = parsed.options.get("--claude-config-json");
	const claude = claudeRaw === undefined ? undefined : parseClaudeConfig(claudeRaw);
	return loadConfig({
		projectDir,
		cli: configLayerFromOptions(parsed),
		claude,
	});
}

function projectDirectory(parsed: ParsedArgs): string {
	const value = parsed.options.get("--project");
	if (value === undefined) {
		return process.cwd();
	}
	return resolve(process.cwd(), value);
}

function printHelp(): void {
	const lines = [
		"glowing-trefoil — shared CLI for the Script Forge plugin",
		"",
		"Usage:",
		"  glowing-trefoil scaffold [name] [--target <dir>] [--force] [--yes] [--no-install] [--no-git]",
		"  glowing-trefoil doctor [dir] [--json]",
		"  glowing-trefoil lint [dir] [--fix] [--yes] [--eslint-config <path>] [-- <eslint args>]",
		"  glowing-trefoil config [--json]",
		"  glowing-trefoil install <cursor|opencode> [--force]",
		"  glowing-trefoil uninstall <cursor|opencode> [--force]",
		"  glowing-trefoil version",
		"",
		"Config options:",
		"  --project <dir>                project directory for config resolution",
		"  --claude-config-json <json>    Claude userConfig values",
		"  --default-namespace <value>",
		"  --scaffold-directory <path>",
		"  --scripts-directory <path>",
		"  --local-directory <path>",
		"  --eslint-config-location <path>",
	];
	console.log(lines.join("\n"));
}

function scaffoldCommand(args: string[]): number {
	const parsed = parseArgs(
		args,
		["--target", "--project", "--claude-config-json", ...CONFIG_OPTION_NAMES],
		["--force", "--yes", "--no-install", "--no-git", "--json", "--help"],
	);
	if (parsed.flags.has("--help")) {
		printHelp();
		return EXIT_SUCCESS;
	}
	if (parsed.positionals.length > 1) {
		throw userError("scaffold accepts at most one workspace name");
	}
	const projectDir = projectDirectory(parsed);
	const config = resolveConfig(parsed, projectDir);
	const targetOption = parsed.options.get("--target");
	const targetDir = targetOption === undefined ? resolveScaffoldTarget(config.values, projectDir) : resolve(projectDir, targetOption);
	const name = parsed.positionals[0] ?? "";
	const result = runScaffold({
		projectDir,
		targetDir,
		name,
		config: config.values,
		force: parsed.flags.has("--force"),
		install: !parsed.flags.has("--no-install"),
		git: !parsed.flags.has("--no-git"),
		yes: parsed.flags.has("--yes"),
	});

	if (parsed.flags.has("--json")) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(`Script Forge scaffold — ${normalizeSlashes(result.target)}`);
		console.log(`Files: ${result.files.join(", ")}`);
		console.log(`ESLint config: ${result.eslintConfigPath}`);
		console.log(`Install: ${result.installStatus}${result.installMessage === null ? "" : ` (${result.installMessage})`}`);
		console.log(`Git: ${result.gitStatus}${result.gitMessage === null ? "" : ` (${result.gitMessage})`}`);
		for (const warning of result.warnings) {
			console.log(`[WARN] ${warning}`);
		}
		console.log(`SUMMARY: ${doctorSummary(result.doctor)}`);
	}
	return result.installStatus === "failed" ? 2 : EXIT_SUCCESS;
}

function levelLabel(level: DoctorLevel): string {
	if (level === "pass") {
		return "PASS";
	}
	if (level === "warn") {
		return "WARN";
	}
	return "FAIL";
}

function doctorCommand(args: string[]): number {
	const parsed = parseArgs(
		args,
		["--project", "--claude-config-json", ...CONFIG_OPTION_NAMES],
		["--json", "--help"],
	);
	if (parsed.flags.has("--help")) {
		printHelp();
		return EXIT_SUCCESS;
	}
	if (parsed.positionals.length > 1) {
		throw userError("doctor accepts at most one directory");
	}
	const baseDir = projectDirectory(parsed);
	const projectDir = parsed.positionals[0] === undefined ? baseDir : resolve(baseDir, parsed.positionals[0]);
	const config = resolveConfig(parsed, projectDir);
	const result = runDoctor({ projectDir, config: config.values });

	if (parsed.flags.has("--json")) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(`Script Forge doctor — target: ${normalizeSlashes(result.target)}`);
		console.log("---");
		for (const check of result.checks) {
			console.log(`[${levelLabel(check.level)}] ${check.message}`);
		}
		console.log("---");
		console.log(`SUMMARY: ${doctorSummary(result)}`);
		if (result.hasTypeScript) {
			console.log("[info] TypeScript sources found — run lint");
		}
	}
	return result.fails > 0 ? 2 : EXIT_SUCCESS;
}

function lintCommand(args: string[]): number {
	const parsed = parseArgs(
		args,
		["--project", "--claude-config-json", "--eslint-config", ...CONFIG_OPTION_NAMES],
		["--fix", "--yes", "--help"],
	);
	if (parsed.flags.has("--help")) {
		printHelp();
		return EXIT_SUCCESS;
	}
	if (parsed.positionals.length > 1) {
		throw userError("lint accepts at most one directory");
	}
	const baseDir = projectDirectory(parsed);
	const projectDir = parsed.positionals[0] === undefined ? baseDir : resolve(baseDir, parsed.positionals[0]);
	const config = resolveConfig(parsed, projectDir);
	const result = runLint({
		projectDir,
		config: config.values,
		fix: parsed.flags.has("--fix"),
		yes: parsed.flags.has("--yes"),
		eslintConfig: parsed.options.get("--eslint-config"),
		extraArgs: parsed.passthrough,
	});
	return result.exitCode;
}

function configCommand(args: string[]): number {
	const parsed = parseArgs(
		args,
		["--project", "--claude-config-json", ...CONFIG_OPTION_NAMES],
		["--json", "--help"],
	);
	if (parsed.flags.has("--help")) {
		printHelp();
		return EXIT_SUCCESS;
	}
	if (parsed.positionals.length > 0) {
		throw userError("config does not accept positional arguments");
	}
	const projectDir = projectDirectory(parsed);
	const resolved = resolveConfig(parsed, projectDir);
	if (parsed.flags.has("--json")) {
		console.log(JSON.stringify(formatConfig(resolved), null, 2));
	} else {
		const formatted = formatConfig(resolved);
		for (const key of CONFIG_KEYS) {
			const entry = formatted[key];
			if (entry !== undefined) {
				const value = entry.value === "" ? "(empty)" : entry.value;
				console.log(`${key} = ${value} (${entry.source})`);
			}
		}
	}
	return EXIT_SUCCESS;
}

function installCommand(args: string[], uninstall: boolean): number {
	const parsed = parseArgs(args, [], ["--force", "--help"]);
	if (parsed.flags.has("--help")) {
		printHelp();
		return EXIT_SUCCESS;
	}
	if (parsed.positionals.length !== 1) {
		throw userError(`${uninstall ? "uninstall" : "install"} requires exactly one target: cursor or opencode`);
	}
	const [target] = parsed.positionals;
	if (target !== "cursor" && target !== "opencode") {
		throw userError(`unknown install target: ${target ?? ""} (expected cursor or opencode)`);
	}
	const typedTarget: InstallTarget = target;
	const options = { force: parsed.flags.has("--force"), homeDir: homedir() };
	let result: ReturnType<typeof installCursor>;
	if (uninstall) {
		result = typedTarget === "cursor" ? uninstallCursor(options) : uninstallOpenCode(options);
	} else {
		result = typedTarget === "cursor" ? installCursor(options) : installOpenCode(options);
	}
	console.log(`${uninstall ? "Removed" : "Installed"} ${result.target}:`);
	for (const path of result.paths) {
		console.log(`  ${normalizeSlashes(path)}`);
	}
	if (!uninstall && result.target === "cursor") {
		console.log("Reload Cursor (Command Palette → Developer: Reload Window) to load the plugin.");
	}
	if (!uninstall && result.target === "opencode") {
		console.log("Restart OpenCode to load the commands and the anvil skill.");
	}
	return EXIT_SUCCESS;
}

function versionCommand(args: string[]): number {
	if (args.length > 0) {
		throw userError("version does not accept arguments");
	}
	console.log(packageVersion());
	return EXIT_SUCCESS;
}

function dispatch(argv: string[]): number {
	const [command] = argv;
	const rest = argv.slice(1);
	if (command === undefined || command === "--help" || command === "-h" || command === "help") {
		printHelp();
		return EXIT_SUCCESS;
	}
	if (command === "scaffold") {
		return scaffoldCommand(rest);
	}
	if (command === "doctor") {
		return doctorCommand(rest);
	}
	if (command === "lint") {
		return lintCommand(rest);
	}
	if (command === "config") {
		return configCommand(rest);
	}
	if (command === "install") {
		return installCommand(rest, false);
	}
	if (command === "uninstall") {
		return installCommand(rest, true);
	}
	if (command === "version") {
		return versionCommand(rest);
	}
	throw userError(`unknown command: ${command}`);
}

function reportError(error: unknown): number {
	if (error instanceof CliError) {
		console.error(`error: ${error.message}`);
		return error.exitCode;
	}
	if (error instanceof Error) {
		console.error(`error: ${error.message}`);
		if (error.stack !== undefined) {
			console.error(error.stack);
		}
		return EXIT_INTERNAL;
	}
	console.error(`error: ${String(error)}`);
	return EXIT_INTERNAL;
}

function main(): void {
	process.on("SIGINT", () => {
		process.exit(EXIT_INTERRUPTED);
	});
	try {
		process.exitCode = dispatch(process.argv.slice(2));
	} catch (error: unknown) {
		process.exitCode = reportError(error);
	}
}

main();
