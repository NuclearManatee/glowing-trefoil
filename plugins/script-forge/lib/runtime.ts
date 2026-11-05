import { spawnSync } from "node:child_process";

export const BUN_PIN = "1.3.14";

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

export function bunVersion(): string | null {
	const result = runCapture("bun", ["--version"]);
	if (result.error !== null || result.status !== 0) {
		return null;
	}
	const version = result.stdout.trim();
	return version === "" ? null : version;
}

export function gitVersion(): string | null {
	const result = runCapture("git", ["--version"]);
	if (result.error !== null || result.status !== 0) {
		return null;
	}
	const version = result.stdout.trim();
	return version === "" ? null : version;
}

export function versionMismatch(pinned: string, actual: string): boolean {
	const wanted = pinned.match(/(\d+)\.(\d+)\.(\d+)/);
	const found = actual.match(/(\d+)\.(\d+)\.(\d+)/);
	if (wanted === null || found === null) {
		return false;
	}
	return wanted.slice(1, 4).join(".") !== found.slice(1, 4).join(".");
}
