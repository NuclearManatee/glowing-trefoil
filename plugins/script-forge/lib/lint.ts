import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Config } from "./config.ts";
import { normalizeSlashes, resolveAbsolute, resolveEslintConfig, resolveWorkspaceDirs } from "./config.ts";
import { environmentError, userError } from "./errors.ts";
import { runCapture, runInherit } from "./runtime.ts";

export type LintOptions = {
	projectDir: string;
	config: Config;
	homeDir?: string;
	fix: boolean;
	yes: boolean;
	eslintConfig?: string;
	extraArgs: string[];
};

export type LintResult = {
	status: number | null;
	exitCode: number;
	configPath: string;
	eslintPath: string;
};

const ESLINT_DEV_DEPENDENCIES = [
	"eslint",
	"@typescript-eslint/eslint-plugin",
	"@typescript-eslint/parser",
	"@stylistic/eslint-plugin",
	"eslint-plugin-unicorn",
] as const;

function javascriptRuntime(): string {
	const node = runCapture("node", ["--version"]);
	if (node.status === 0) {
		return "node";
	}
	return process.execPath;
}

function mapExitCode(status: number | null): number {
	if (status === 0) {
		return 0;
	}
	if (status === 1) {
		return 1;
	}
	if (status === 2) {
		return 2;
	}
	return 4;
}

export function runLint(options: LintOptions): LintResult {
	if (!existsSync(join(options.projectDir, "package.json"))) {
		throw environmentError(`package.json not found in ${normalizeSlashes(options.projectDir)} — scaffold the workspace first`);
	}
	if (options.fix && !options.yes) {
		throw userError("lint --fix writes files; pass --yes after obtaining explicit user consent");
	}

	const homeDir = options.homeDir ?? homedir();
	let configPath: string;
	if (options.eslintConfig !== undefined && options.eslintConfig !== "") {
		configPath = resolveAbsolute(options.eslintConfig, options.projectDir, homeDir);
	} else {
		const resolved = resolveEslintConfig(options.config, options.projectDir, homeDir);
		if (resolved === null) {
			throw environmentError(
				"ESLint config not found — run `glowing-trefoil scaffold --force --yes`, copy eslint.tooling.js, or set esLintConfigLocation",
			);
		}
		configPath = resolved.path;
	}
	if (!existsSync(configPath)) {
		throw environmentError(`ESLint config not found at ${normalizeSlashes(configPath)}`);
	}

	const eslintPath = join(options.projectDir, "node_modules", "eslint", "bin", "eslint.js");
	if (!existsSync(eslintPath)) {
		throw environmentError(
			`ESLint is not installed in the project — run \`npm install -D ${ESLINT_DEV_DEPENDENCIES.join(" ")}\``,
		);
	}

	const { scriptsDir, localDir } = resolveWorkspaceDirs(options.config);
	const args = [
		eslintPath,
		"--no-error-on-unmatched-pattern",
		"--config",
		configPath,
		...(options.fix ? ["--fix"] : []),
		`${scriptsDir.replaceAll("\\", "/")}/**/*.ts`,
		`${localDir.replaceAll("\\", "/")}/tmp/**/*.ts`,
		...options.extraArgs,
	];

	const status = runInherit(javascriptRuntime(), args, options.projectDir);
	return {
		status,
		exitCode: mapExitCode(status),
		configPath,
		eslintPath,
	};
}
