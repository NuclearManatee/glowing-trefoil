import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	installCursor,
	installOpenCode,
	uninstallCursor,
	uninstallOpenCode,
} from "../plugins/script-forge/lib/install.ts";

const roots: string[] = [];

function temporaryHome(): string {
	const root = mkdtempSync(join(tmpdir(), "gt-install-"));
	roots.push(root);
	return root;
}

afterAll(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("Cursor install", () => {
	test("copies the plugin, writes a marker, and uninstalls cleanly", () => {
		const home = temporaryHome();
		const result = installCursor({ homeDir: home, force: false });
		const destination = join(home, ".cursor", "plugins", "local", "script-forge");

		expect(result.paths).toEqual([destination]);
		expect(existsSync(join(destination, ".cursor-plugin", "plugin.json"))).toBe(true);
		expect(existsSync(join(destination, "commands-cursor", "scaffold.md"))).toBe(true);
		expect(existsSync(join(destination, ".glowing-trefoil.json"))).toBe(true);

		installCursor({ homeDir: home, force: false });

		uninstallCursor({ homeDir: home, force: false });
		expect(existsSync(destination)).toBe(false);
	});

	test("refuses to overwrite a folder it does not own", () => {
		const home = temporaryHome();
		const destination = join(home, ".cursor", "plugins", "local", "script-forge");
		installCursor({ homeDir: home, force: false });
		unlinkSync(join(destination, ".glowing-trefoil.json"));

		expect(() => installCursor({ homeDir: home, force: false })).toThrow(/refusing to overwrite/);
	});
});

describe("OpenCode install", () => {
	test("copies flat commands and the anvil skill, then uninstalls only its files", () => {
		const home = temporaryHome();
		const commandsDir = join(home, ".config", "opencode", "commands");
		const skillDir = join(home, ".agents", "skills", "anvil");

		installOpenCode({ homeDir: home, force: false });

		expect(existsSync(join(commandsDir, "script-forge-scaffold.md"))).toBe(true);
		expect(existsSync(join(commandsDir, "script-forge-doctor.md"))).toBe(true);
		expect(existsSync(join(commandsDir, "script-forge-lint.md"))).toBe(true);
		expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);
		expect(existsSync(join(skillDir, ".glowing-trefoil.json"))).toBe(true);

		writeFileSync(join(commandsDir, "unrelated.md"), "keep me\n");
		uninstallOpenCode({ homeDir: home, force: false });

		expect(existsSync(join(commandsDir, "script-forge-scaffold.md"))).toBe(false);
		expect(existsSync(join(skillDir))).toBe(false);
		expect(readFileSync(join(commandsDir, "unrelated.md"), "utf8")).toBe("keep me\n");
	});

	test("refuses to overwrite a foreign command file", () => {
		const home = temporaryHome();
		const commandsDir = join(home, ".config", "opencode", "commands");
		const target = join(commandsDir, "script-forge-scaffold.md");
		installOpenCode({ homeDir: home, force: false });
		uninstallOpenCode({ homeDir: home, force: false });
		writeFileSync(target, "user file\n");

		expect(() => installOpenCode({ homeDir: home, force: false })).toThrow(/refusing to overwrite/);
	});
});
