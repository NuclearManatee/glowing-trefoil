import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMMAND_NAMES, CLI_PACKAGE, GENERATED_MARKER, type CommandName } from "../plugins/script-forge/lib/commands.ts";
import { commandsSourceDir, pluginRoot } from "../plugins/script-forge/lib/paths.ts";
import { internalError } from "../plugins/script-forge/lib/errors.ts";

type CommandSource = {
	name: CommandName;
	title: string;
	description: string;
	argumentHint: string;
	body: string;
};

function parseFrontmatter(raw: string, name: string): CommandSource {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (match === null) {
		throw internalError(`commands-src/${name}.md is missing frontmatter`);
	}
	const [, frontmatter, body] = match;
	if (frontmatter === undefined || body === undefined) {
		throw internalError(`commands-src/${name}.md is malformed`);
	}
	const fields = new Map<string, string>();
	for (const line of frontmatter.split(/\r?\n/)) {
		const separator = line.indexOf(":");
		if (separator === -1) {
			continue;
		}
		const key = line.slice(0, separator).trim();
		let value = line.slice(separator + 1).trim();
		if (
			(value.startsWith("\"") && value.endsWith("\"")) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		fields.set(key, value);
	}
	const title = fields.get("title");
	const description = fields.get("description");
	if (title === undefined || description === undefined) {
		throw internalError(`commands-src/${name}.md needs "title" and "description"`);
	}
	return {
		name: name as CommandName,
		title,
		description,
		argumentHint: fields.get("argument-hint") ?? "",
		body: body.trim(),
	};
}

function readSources(): CommandSource[] {
	return COMMAND_NAMES.map((name) => {
		const raw = readFileSync(join(commandsSourceDir(), `${name}.md`), "utf8");
		return parseFrontmatter(raw, name);
	});
}

function claudeConfigArgument(): string {
	const config = {
		defaultNamespace: "${user_config.defaultNamespace}",
		scaffoldDirectory: "${user_config.scaffoldDirectory}",
		scriptsDirectory: "${user_config.scriptsDirectory}",
		localDirectory: "${user_config.localDirectory}",
		esLintConfigLocation: "${user_config.esLintConfigLocation}",
	};
	return `--claude-config-json '${JSON.stringify(config)}'`;
}

function claudeInvocation(name: CommandName): string {
	const config = claudeConfigArgument();
	let command: string;
	if (name === "scaffold") {
		command = `npx -y ${CLI_PACKAGE} scaffold $ARGUMENTS --yes ${config}`;
	} else if (name === "doctor") {
		command = `npx -y ${CLI_PACKAGE} doctor $ARGUMENTS ${config}`;
	} else {
		command = `npx -y ${CLI_PACKAGE} lint $ARGUMENTS --yes ${config}`;
	}
	return `Run this command:\n\n\`\`\`sh\n${command}\n\`\`\``;
}

function cursorInvocation(name: CommandName): string {
	if (name === "scaffold") {
		return `Run \`npx -y ${CLI_PACKAGE} scaffold\` with the name and flags the user supplied after the command. Add \`--yes\` only after the user has consented.`;
	}
	if (name === "doctor") {
		return `Run \`npx -y ${CLI_PACKAGE} doctor\` with the directory the user supplied after the command, or the current directory.`;
	}
	return `Run \`npx -y ${CLI_PACKAGE} lint\` with the directory and flags the user supplied after the command. Add \`--yes\` when using \`--fix\`, after the user has consented.`;
}

function openCodeInvocation(name: CommandName): string {
	const suffix = name === "doctor" ? "" : " --yes";
	return `Run this command:\n\n\`\`\`sh\nnpx -y ${CLI_PACKAGE} ${name} $ARGUMENTS${suffix}\n\`\`\``;
}

function renderBody(source: CommandSource, invocation: string): string {
	if (!source.body.includes("{{invocation}}")) {
		throw internalError(`commands-src/${source.name}.md is missing {{invocation}}`);
	}
	return source.body.split("{{invocation}}").join(invocation);
}

function renderClaude(source: CommandSource): string {
	return [
		"---",
		`description: ${JSON.stringify(source.description)}`,
		`argument-hint: ${JSON.stringify(source.argumentHint)}`,
		"user-invocable: true",
		"disable-model-invocation: true",
		"allowed-tools: Bash(npx:*)",
		"---",
		"",
		GENERATED_MARKER,
		"",
		renderBody(source, claudeInvocation(source.name)),
		"",
	].join("\n");
}

function renderCursor(source: CommandSource): string {
	return [
		"---",
		`name: ${JSON.stringify(`script-forge-${source.name}`)}`,
		`description: ${JSON.stringify(source.description)}`,
		"---",
		"",
		GENERATED_MARKER,
		"",
		renderBody(source, cursorInvocation(source.name)),
		"",
	].join("\n");
}

function renderOpenCode(source: CommandSource): string {
	return [
		"---",
		`description: ${JSON.stringify(source.description)}`,
		"---",
		"",
		GENERATED_MARKER,
		"",
		renderBody(source, openCodeInvocation(source.name)),
		"",
	].join("\n");
}

function writeGenerated(directory: string, filename: string, content: string): void {
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, filename), content, "utf8");
}

function main(): void {
	const sources = readSources();
	const claudeDir = join(pluginRoot(), "commands");
	const cursorDir = join(pluginRoot(), "commands-cursor");
	const openCodeDir = join(pluginRoot(), "commands-opencode");

	for (const directory of [claudeDir, cursorDir, openCodeDir]) {
		rmSync(directory, { recursive: true, force: true });
	}

	for (const source of sources) {
		writeGenerated(claudeDir, `${source.name}.md`, renderClaude(source));
		writeGenerated(cursorDir, `${source.name}.md`, renderCursor(source));
		writeGenerated(openCodeDir, `script-forge-${source.name}.md`, renderOpenCode(source));
	}

	console.log(`Generated ${sources.length * 3} command files from ${sources.length} sources.`);
}

main();
