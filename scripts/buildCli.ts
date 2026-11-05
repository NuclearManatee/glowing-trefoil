import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const outdir = join(root, "dist");
const entrypoint = join(root, "plugins", "script-forge", "cli", "index.ts");

mkdirSync(outdir, { recursive: true });

const result = await Bun.build({
	entrypoints: [entrypoint],
	outdir,
	target: "node",
	format: "esm",
	minify: false,
	sourcemap: "none",
	naming: "cli.js",
});

if (!result.success) {
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

const outputPath = join(outdir, "cli.js");
const fallbackPath = join(outdir, "index.js");
if (!existsSync(outputPath) && existsSync(fallbackPath)) {
	renameSync(fallbackPath, outputPath);
}
if (!existsSync(outputPath)) {
	console.error("build failed: dist/cli.js was not produced");
	process.exit(1);
}

const content = readFileSync(outputPath, "utf8");
if (!content.startsWith("#!")) {
	writeFileSync(outputPath, `#!/usr/bin/env node\n${content}`, "utf8");
}
chmodSync(outputPath, 0o755);

console.log(`Built ${outputPath}`);
