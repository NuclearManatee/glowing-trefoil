import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

export const NODE_MIN = "22.18.0";

export type CommandResult = {
	status: number | null;
	stdout: string;
	stderr: string;
	error: string | null;
};

export function runCapture(command: string, args: string[], cwd?: string): CommandResult {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		shell: false,
		windowsHide: true,
	});
	return {
		status: result.status,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
		error: result.error === undefined ? null : result.error.message,
	};
}

export function runInherit(command: string, args: string[], cwd?: string): number {
	const result = spawnSync(command, args, {
		cwd,
		stdio: "inherit",
		shell: false,
		windowsHide: true,
	});
	if (result.error !== undefined) {
		return -1;
	}
	return result.status ?? -1;
}

type ParsedVersion = {
	major: number;
	minor: number;
	patch: number;
};

function parseVersion(value: string): ParsedVersion | null {
	const match = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(value);
	if (match === null) {
		return null;
	}
	const [, major = "0", minor = "0", patch = "0"] = match;
	return {
		major: Number(major),
		minor: Number(minor),
		patch: Number(patch),
	};
}

export function nodeVersion(): string {
	return process.versions.node;
}

export function meetsMinimum(actual: string, minimum: string): boolean {
	const found = parseVersion(actual);
	const wanted = parseVersion(minimum);
	if (found === null || wanted === null) {
		return false;
	}
	if (found.major !== wanted.major) {
		return found.major > wanted.major;
	}
	if (found.minor !== wanted.minor) {
		return found.minor > wanted.minor;
	}
	return found.patch >= wanted.patch;
}

// npm is a .cmd shim on Windows, which child_process cannot spawn with
// shell: false. Resolve its JavaScript entry point and run it with Node instead;
// this keeps the shell-free subprocess rule intact on every platform.
export function npmCliPath(): string | null {
	const fromEnv = process.env.npm_execpath;
	if (fromEnv !== undefined && fromEnv.endsWith("npm-cli.js") && existsSync(fromEnv)) {
		return fromEnv;
	}
	const nodeDir = dirname(process.execPath);
	const candidates = [
		join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"),
		join(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
	];
	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	return null;
}

export function runNpm(args: string[], cwd: string): number {
	const cli = npmCliPath();
	if (cli === null) {
		return -1;
	}
	return runInherit(process.execPath, [cli, ...args], cwd);
}

export function gitVersion(): string | null {
	const result = runCapture("git", ["--version"]);
	if (result.error !== null || result.status !== 0) {
		return null;
	}
	const version = result.stdout.trim();
	return version === "" ? null : version;
}
