import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
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

after(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("Cursor install", () => {
	test("copies the plugin, writes a marker, and uninstalls cleanly", () => {
		const home = temporaryHome();
		const result = installCursor({ homeDir: home, force: false });
		const destination = join(home, ".cursor", "plugins", "local", "script-forge");

		assert.deepEqual(result.paths, [destination]);
		assert.ok(existsSync(join(destination, ".cursor-plugin", "plugin.json")));
		assert.ok(existsSync(join(destination, "commands-cursor", "scaffold.md")));
		assert.ok(existsSync(join(destination, ".glowing-trefoil.json")));

		installCursor({ homeDir: home, force: false });

		uninstallCursor({ homeDir: home, force: false });
		assert.equal(existsSync(destination), false);
	});

	test("refuses to overwrite a folder it does not own", () => {
		const home = temporaryHome();
		const destination = join(home, ".cursor", "plugins", "local", "script-forge");
		installCursor({ homeDir: home, force: false });
		unlinkSync(join(destination, ".glowing-trefoil.json"));

		assert.throws(() => installCursor({ homeDir: home, force: false }), /refusing to overwrite/);
	});
});

describe("OpenCode install", () => {
	test("copies flat commands and the anvil skill, then uninstalls only its files", () => {
		const home = temporaryHome();
		const commandsDir = join(home, ".config", "opencode", "commands");
		const skillDir = join(home, ".agents", "skills", "anvil");

		installOpenCode({ homeDir: home, force: false });

		assert.ok(existsSync(join(commandsDir, "script-forge-scaffold.md")));
		assert.ok(existsSync(join(commandsDir, "script-forge-doctor.md")));
		assert.ok(existsSync(join(commandsDir, "script-forge-lint.md")));
		assert.ok(existsSync(join(skillDir, "SKILL.md")));
		assert.ok(existsSync(join(skillDir, ".glowing-trefoil.json")));

		writeFileSync(join(commandsDir, "unrelated.md"), "keep me\n");
		uninstallOpenCode({ homeDir: home, force: false });

		assert.equal(existsSync(join(commandsDir, "script-forge-scaffold.md")), false);
		assert.equal(existsSync(join(skillDir)), false);
		assert.equal(readFileSync(join(commandsDir, "unrelated.md"), "utf8"), "keep me\n");
	});

	test("refuses to overwrite a foreign command file", () => {
		const home = temporaryHome();
		const commandsDir = join(home, ".config", "opencode", "commands");
		const target = join(commandsDir, "script-forge-scaffold.md");
		installOpenCode({ homeDir: home, force: false });
		uninstallOpenCode({ homeDir: home, force: false });
		writeFileSync(target, "user file\n");

		assert.throws(() => installOpenCode({ homeDir: home, force: false }), /refusing to overwrite/);
	});
});
