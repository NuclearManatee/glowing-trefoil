import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { validateRepository } from "../scripts/validate.ts";

const roots: string[] = [];

function temporaryRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "gt-validate-"));
	roots.push(root);
	return root;
}

function write(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf8");
}

function buildFixture(): string {
	const root = temporaryRoot();
	write(
		join(root, "package.json"),
		JSON.stringify({
			name: "glowing-trefoil",
			version: "1.0.0",
			license: "MIT",
			bin: { "glowing-trefoil": "./dist/cli.js" },
			files: ["dist", "plugins/script-forge"],
		}),
	);
	write(
		join(root, ".claude-plugin", "marketplace.json"),
		JSON.stringify({ name: "glowing-trefoil", plugins: [{ name: "sample", source: "./plugins/sample" }] }),
	);
	write(
		join(root, ".cursor-plugin", "marketplace.json"),
		JSON.stringify({ name: "glowing-trefoil", plugins: [{ name: "sample", source: "./plugins/sample" }] }),
	);

	const plugin = join(root, "plugins", "sample");
	for (const manifest of [".claude-plugin", ".cursor-plugin"]) {
		write(
			join(plugin, manifest, "plugin.json"),
			JSON.stringify({ name: "sample", version: "1.0.0" }),
		);
	}
	for (const name of ["scaffold", "doctor", "lint"]) {
		write(
			join(plugin, "commands", `${name}.md`),
			`---\nallowed-tools: Bash(npx:*)\n---\n\nnpx -y glowing-trefoil ${name}\n`,
		);
		write(join(plugin, "commands-cursor", `${name}.md`), `---\nname: sample-${name}\n---\n\nRun npx.\n`);
		write(join(plugin, "commands-opencode", `script-forge-${name}.md`), `---\ndescription: ${name}\n---\n\nRun npx.\n`);
		write(join(plugin, "commands-src", `${name}.md`), `---\ntitle: ${name}\n---\n\n{{invocation}}\n`);
	}
	write(
		join(plugin, "skills", "anvil", "SKILL.md"),
		"---\nname: anvil\ndescription: Build tooling scripts.\n---\n\n# Anvil\n",
	);
	write(join(plugin, "assets", "script-forge.md"), "# Rulebook\n");
	write(join(plugin, "templates", ".gitkeep"), "");
	return root;
}

afterAll(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("repository validator", () => {
	test("a well-formed fixture passes", () => {
		const result = validateRepository(buildFixture());
		expect(result.failures).toBe(0);
		expect(result.passes).toBeGreaterThan(0);
	});

	test("a skill whose frontmatter name does not match its folder fails", () => {
		const root = buildFixture();
		write(join(root, "plugins", "sample", "skills", "anvil", "SKILL.md"), "---\nname: other\n---\n");
		const result = validateRepository(root);
		expect(result.lines.some((line) => line.includes("frontmatter name matches") && line.startsWith("[FAIL]"))).toBe(true);
	});

	test("a forbidden portable string in the rulebook fails", () => {
		const root = buildFixture();
		write(join(root, "plugins", "sample", "assets", "script-forge.md"), "Use AskUserQuestion.\n");
		const result = validateRepository(root);
		expect(result.lines.some((line) => line.includes("AskUserQuestion") && line.startsWith("[FAIL]"))).toBe(true);
	});

	test("a top-level bin/ directory fails", () => {
		const root = buildFixture();
		mkdirSync(join(root, "plugins", "sample", "bin"), { recursive: true });
		const result = validateRepository(root);
		expect(result.lines.some((line) => line.includes("no top-level bin/") && line.startsWith("[FAIL]"))).toBe(true);
	});

	test("a marketplace pointing at a missing plugin fails", () => {
		const root = buildFixture();
		write(
			join(root, ".claude-plugin", "marketplace.json"),
			JSON.stringify({ name: "glowing-trefoil", plugins: [{ name: "ghost", source: "./plugins/ghost" }] }),
		);
		const result = validateRepository(root);
		expect(result.failures).toBeGreaterThan(0);
	});
});
