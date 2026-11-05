import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { Config } from "./config.ts";
import { normalizeSlashes, resolveAbsolute, resolveWorkspaceDirs } from "./config.ts";
import type { DoctorResult } from "./doctor.ts";
import { runDoctor } from "./doctor.ts";
import { internalError, userError } from "./errors.ts";
import { assetsDir, templatesDir } from "./paths.ts";
import { bunVersion, gitVersion, runCapture, runInherit } from "./runtime.ts";

export type ScaffoldOptions = {
	projectDir: string;
	targetDir: string;
	name: string;
	config: Config;
	homeDir?: string;
	force: boolean;
	install: boolean;
	git: boolean;
	yes: boolean;
};

export type ScaffoldResult = {
	target: string;
	files: string[];
	eslintConfigPath: string;
	installStatus: "installed" | "skipped" | "failed";
	installMessage: string | null;
	gitStatus: "committed" | "initialized" | "skipped" | "missing";
	gitMessage: string | null;
	warnings: string[];
	doctor: DoctorResult;
};

export function sanitizeName(value: string): string {
	const sanitized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return sanitized === "" ? "script-forge-workspace" : sanitized;
}

function copyTemplates(targetDir: string): void {
	for (const entry of readdirSync(templatesDir())) {
		cpSync(join(templatesDir(), entry), join(targetDir, entry), {
			recursive: true,
			force: true,
		});
	}
	// npm strips `.gitignore` from published packages, so the template ships as
	// `gitignore` and is renamed here.
	const templateGitignore = join(targetDir, "gitignore");
	if (existsSync(templateGitignore)) {
		const destination = join(targetDir, ".gitignore");
		if (existsSync(destination)) {
			rmSync(destination, { force: true });
		}
		renameSync(templateGitignore, destination);
	}
}

function moveTemplateDir(targetDir: string, from: string, to: string, warnings: string[]): void {
	if (from === to) {
		return;
	}
	const source = join(targetDir, from);
	const destination = join(targetDir, to);
	if (!existsSync(source)) {
		return;
	}
	if (existsSync(destination)) {
		warnings.push(`${normalizeSlashes(to)}/ already exists; left ${normalizeSlashes(from)}/ in place`);
		return;
	}
	mkdirSync(dirname(destination), { recursive: true });
	renameSync(source, destination);
}

function rewriteTemplateFiles(targetDir: string, replacements: Record<string, string>): void {
	for (const name of ["package.json", "tsconfig.json", ".gitignore"]) {
		const path = join(targetDir, name);
		if (!existsSync(path)) {
			continue;
		}
		let content = readFileSync(path, "utf8");
		for (const [placeholder, value] of Object.entries(replacements)) {
			content = content.split(placeholder).join(value);
		}
		writeFileSync(path, content, "utf8");
	}
}

function copyEslintConfig(
	targetDir: string,
	config: Config,
	homeDir: string,
	warnings: string[],
): { packagePath: string; copied: boolean } {
	if (config.esLintConfigLocation !== "") {
		const configured = resolveAbsolute(config.esLintConfigLocation, targetDir, homeDir);
		if (!existsSync(configured)) {
			warnings.push(`configured ESLint config not found: ${normalizeSlashes(configured)}`);
		}
		return { packagePath: normalizeSlashes(configured), copied: false };
	}
	const source = join(assetsDir(), "eslint.tooling.js");
	const destination = join(targetDir, "eslint.tooling.js");
	cpSync(source, destination, { force: true });
	return { packagePath: "./eslint.tooling.js", copied: true };
}

function installDependencies(targetDir: string, enabled: boolean, warnings: string[]): Pick<ScaffoldResult, "installStatus" | "installMessage"> {
	if (!enabled) {
		return { installStatus: "skipped", installMessage: "dependency install skipped (--no-install)" };
	}
	if (bunVersion() === null) {
		const message = "Bun not found — install Bun 1.3.14, then run `bun install` in the workspace";
		warnings.push(message);
		return { installStatus: "skipped", installMessage: message };
	}
	const status = runInherit("bun", ["install"], targetDir);
	if (status !== 0) {
		const message = `bun install failed (exit ${status}) — run it again in ${normalizeSlashes(targetDir)}`;
		warnings.push(message);
		return { installStatus: "failed", installMessage: message };
	}
	return { installStatus: "installed", installMessage: null };
}

function initializeGit(targetDir: string, enabled: boolean, warnings: string[]): Pick<ScaffoldResult, "gitStatus" | "gitMessage"> {
	if (!enabled) {
		return { gitStatus: "skipped", gitMessage: "git initialization skipped (--no-git)" };
	}
	if (gitVersion() === null) {
		const message = "git not found — workspace created without a repository";
		warnings.push(message);
		return { gitStatus: "missing", gitMessage: message };
	}
	const init = runCapture("git", ["init", "-b", "main"], targetDir);
	if (init.status !== 0) {
		const message = `git init failed: ${init.stderr.trim()}`;
		warnings.push(message);
		return { gitStatus: "skipped", gitMessage: message };
	}
	const name = runCapture("git", ["config", "--get", "user.name"], targetDir);
	const email = runCapture("git", ["config", "--get", "user.email"], targetDir);
	if (name.stdout.trim() === "" || email.stdout.trim() === "") {
		const message = "git identity not configured — repository initialized without a first commit";
		warnings.push(message);
		return { gitStatus: "initialized", gitMessage: message };
	}
	const add = runCapture("git", ["add", "."], targetDir);
	if (add.status !== 0) {
		const message = `git add failed: ${add.stderr.trim()}`;
		warnings.push(message);
		return { gitStatus: "initialized", gitMessage: message };
	}
	const commit = runCapture("git", ["commit", "-m", "chore: scaffold script-forge workspace"], targetDir);
	if (commit.status !== 0) {
		const message = `git commit failed: ${commit.stderr.trim()}`;
		warnings.push(message);
		return { gitStatus: "initialized", gitMessage: message };
	}
	return { gitStatus: "committed", gitMessage: null };
}

export function runScaffold(options: ScaffoldOptions): ScaffoldResult {
	if (!options.yes) {
		throw userError("scaffold writes files; pass --yes after obtaining explicit user consent");
	}
	const target = options.targetDir;
	const warnings: string[] = [];

	if (existsSync(target)) {
		const stats = statSync(target);
		if (!stats.isDirectory()) {
			throw userError(`target exists and is not a directory: ${normalizeSlashes(target)}`);
		}
		if (existsSync(join(target, "package.json")) && !options.force) {
			throw userError(`already scaffolded: ${normalizeSlashes(target)} (pass --force to overwrite template files)`);
		}
	} else {
		mkdirSync(target, { recursive: true });
	}

	copyTemplates(target);
	const { scriptsDir, localDir } = resolveWorkspaceDirs(options.config);
	moveTemplateDir(target, "scripts", scriptsDir, warnings);
	moveTemplateDir(target, "local", localDir, warnings);

	const required = [
		"package.json",
		"tsconfig.json",
		".gitignore",
		join(scriptsDir, ".gitkeep"),
		join(localDir, "tmp", ".gitkeep"),
		join(localDir, "raw_data", ".gitkeep"),
	];
	for (const relative of required) {
		if (!existsSync(join(target, relative))) {
			throw internalError(`template copy incomplete: missing ${normalizeSlashes(relative)}`);
		}
	}

	const eslint = copyEslintConfig(target, options.config, options.homeDir ?? homedir(), warnings);
	const projectName = options.name === "" ? sanitizeName(basename(target)) : sanitizeName(options.name);
	rewriteTemplateFiles(target, {
		"{{name}}": projectName,
		"{{eslintConfigPath}}": eslint.packagePath,
		"{{bunPin}}": "1.3.14",
		"{{scriptsDir}}": scriptsDir,
		"{{localDir}}": localDir,
	});

	const install = installDependencies(target, options.install, warnings);
	const git = initializeGit(target, options.git, warnings);
	const doctor = runDoctor({
		projectDir: target,
		config: options.config,
		homeDir: options.homeDir,
	});

	const files = [
		"package.json",
		"tsconfig.json",
		".gitignore",
		`${scriptsDir}/.gitkeep`,
		`${localDir}/tmp/.gitkeep`,
		`${localDir}/raw_data/.gitkeep`,
	];
	if (eslint.copied) {
		files.push("eslint.tooling.js");
	}

	return {
		target,
		files,
		eslintConfigPath: eslint.packagePath,
		...install,
		...git,
		warnings,
		doctor,
	};
}
