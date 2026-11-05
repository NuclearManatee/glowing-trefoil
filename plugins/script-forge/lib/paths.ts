import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { internalError } from "./errors.ts";

const moduleDir = dirname(fileURLToPath(import.meta.url));
let cachedRoot: string | null = null;

export function packageRoot(): string {
	if (cachedRoot !== null) {
		return cachedRoot;
	}
	let current = moduleDir;
	for (let depth = 0; depth < 8; depth++) {
		if (existsSync(join(current, "plugins", "script-forge", "assets", "script-forge.md"))) {
			cachedRoot = current;
			return current;
		}
		if (existsSync(join(current, "assets", "script-forge.md")) && existsSync(join(current, "..", "..", "package.json"))) {
			cachedRoot = join(current, "..", "..");
			return cachedRoot;
		}
		const parent = dirname(current);
		if (parent === current) {
			break;
		}
		current = parent;
	}
	throw internalError("Could not locate the glowing-trefoil package root");
}

export function pluginRoot(): string {
	return join(packageRoot(), "plugins", "script-forge");
}

export function assetsDir(): string {
	return join(pluginRoot(), "assets");
}

export function templatesDir(): string {
	return join(pluginRoot(), "templates");
}

export function skillsDir(): string {
	return join(pluginRoot(), "skills");
}

export function commandsSourceDir(): string {
	return join(pluginRoot(), "commands-src");
}

export function packageVersion(): string {
	const raw = readFileSync(join(packageRoot(), "package.json"), "utf8");
	const parsed = JSON.parse(raw) as { version?: unknown };
	return typeof parsed.version === "string" ? parsed.version : "0.0.0";
}
