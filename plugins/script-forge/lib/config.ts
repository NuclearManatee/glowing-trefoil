import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, normalize, posix, resolve } from "node:path";
import { z } from "zod";
import { userError } from "./errors.ts";

export const CONFIG_KEYS = [
	"defaultNamespace",
	"scaffoldDirectory",
	"scriptsDirectory",
	"localDirectory",
	"esLintConfigLocation",
] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];
export type ConfigSource = "cli" | "project" | "claude" | "global" | "default";
export type ConfigLayer = Partial<Record<ConfigKey, string>>;

const configSchema = z.object({
	defaultNamespace: z.string(),
	scaffoldDirectory: z.string(),
	scriptsDirectory: z.string(),
	localDirectory: z.string(),
	esLintConfigLocation: z.string(),
});

export type Config = z.infer<typeof configSchema>;

export type ResolvedConfig = {
	values: Config;
	sources: Record<ConfigKey, ConfigSource>;
};

export type LoadConfigOptions = {
	projectDir: string;
	cli?: ConfigLayer;
	claude?: ConfigLayer;
	homeDir?: string;
};

const DEFAULTS: Config = {
	defaultNamespace: "tools",
	scaffoldDirectory: "",
	scriptsDirectory: "scripts",
	localDirectory: "local",
	esLintConfigLocation: "",
};

function readJson(path: string): unknown {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw userError(`Cannot parse ${path}: ${message}`);
	}
}

function toLayer(value: unknown, label: string): ConfigLayer {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw userError(`${label} must be a JSON object`);
	}
	const record = value as Record<string, unknown>;
	const layer: ConfigLayer = {};
	for (const key of CONFIG_KEYS) {
		const entry = record[key];
		if (entry === undefined) {
			continue;
		}
		if (typeof entry !== "string") {
			throw userError(`${label}: "${key}" must be a string`);
		}
		layer[key] = entry;
	}
	return layer;
}

function readLayer(path: string, label: string): ConfigLayer {
	if (!existsSync(path)) {
		return {};
	}
	return toLayer(readJson(path), label);
}

export function parseConfigLayer(value: unknown, label: string): ConfigLayer {
	return toLayer(value, label);
}

export function parseClaudeConfig(raw: string): ConfigLayer {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw userError(`--claude-config-json is not valid JSON: ${message}`);
	}
	return toLayer(parsed, "--claude-config-json");
}

export function globalConfigPath(homeDir: string = homedir()): string {
	return join(homeDir, ".config", "script-forge", "config.json");
}

export function projectConfigPath(projectDir: string): string {
	return join(projectDir, ".script-forge.json");
}

function mergeLayer(resolved: ResolvedConfig, layer: ConfigLayer, source: ConfigSource): void {
	for (const key of CONFIG_KEYS) {
		const value = layer[key];
		if (value === undefined || value === "") {
			continue;
		}
		resolved.values[key] = value;
		resolved.sources[key] = source;
	}
}

export function loadConfig(options: LoadConfigOptions): ResolvedConfig {
	const homeDir = options.homeDir ?? homedir();
	const globalLayer = readLayer(globalConfigPath(homeDir), "global config");
	const projectLayer = readLayer(projectConfigPath(options.projectDir), "project config");

	const resolved: ResolvedConfig = {
		values: { ...DEFAULTS },
		sources: {
			defaultNamespace: "default",
			scaffoldDirectory: "default",
			scriptsDirectory: "default",
			localDirectory: "default",
			esLintConfigLocation: "default",
		},
	};

	mergeLayer(resolved, globalLayer, "global");
	if (options.claude !== undefined) {
		mergeLayer(resolved, options.claude, "claude");
	}
	mergeLayer(resolved, projectLayer, "project");
	if (options.cli !== undefined) {
		mergeLayer(resolved, options.cli, "cli");
	}

	resolved.values = configSchema.parse(resolved.values);
	return resolved;
}

export function normalizeSlashes(value: string): string {
	return value.replaceAll("\\", "/");
}

export function expandHome(value: string, homeDir: string = homedir()): string {
	if (value === "~") {
		return homeDir;
	}
	if (value.startsWith("~/") || value.startsWith("~\\")) {
		return join(homeDir, value.slice(2));
	}
	return value;
}

export function resolveAbsolute(value: string, baseDir: string, homeDir: string = homedir()): string {
	const expanded = expandHome(value, homeDir);
	return normalize(isAbsolute(expanded) ? expanded : resolve(baseDir, expanded));
}

export function assertWorkspaceRelative(value: string, key: string): string {
	const trimmed = value.trim();
	if (trimmed === "") {
		throw userError(`${key} must not be empty`);
	}
	const normalized = posix.normalize(normalizeSlashes(trimmed)).replace(/\/+$/, "");
	if (
		normalized === "" ||
		normalized === "." ||
		normalized === ".." ||
		normalized.startsWith("../") ||
		normalized.startsWith("/") ||
		isAbsolute(trimmed) ||
		/^[a-zA-Z]:/.test(trimmed)
	) {
		throw userError(`${key} must be a workspace-relative path without ".." escapes: ${value}`);
	}
	return normalized;
}

export function resolveWorkspaceDirs(config: Config): { scriptsDir: string; localDir: string } {
	return {
		scriptsDir: assertWorkspaceRelative(config.scriptsDirectory, "scriptsDirectory"),
		localDir: assertWorkspaceRelative(config.localDirectory, "localDirectory"),
	};
}

export function resolveScaffoldTarget(config: Config, projectDir: string, homeDir: string = homedir()): string {
	if (config.scaffoldDirectory === "") {
		return projectDir;
	}
	return resolveAbsolute(config.scaffoldDirectory, projectDir, homeDir);
}

export type EslintConfigResolution = {
	path: string;
	source: "configured" | "project";
};

export function resolveEslintConfig(
	config: Config,
	projectDir: string,
	homeDir: string = homedir(),
): EslintConfigResolution | null {
	if (config.esLintConfigLocation !== "") {
		return {
			path: resolveAbsolute(config.esLintConfigLocation, projectDir, homeDir),
			source: "configured",
		};
	}
	const local = join(projectDir, "eslint.tooling.js");
	if (existsSync(local)) {
		return { path: local, source: "project" };
	}
	return null;
}

export function formatConfig(resolved: ResolvedConfig): Record<string, { value: string; source: ConfigSource }> {
	const output: Record<string, { value: string; source: ConfigSource }> = {};
	for (const key of CONFIG_KEYS) {
		output[key] = {
			value: resolved.values[key],
			source: resolved.sources[key],
		};
	}
	return output;
}
