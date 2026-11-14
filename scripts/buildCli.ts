import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
const outdir = join(root, "dist");
const outputPath = join(outdir, "cli", "index.js");

if (!existsSync(tsc)) {
	console.error("build failed: typescript is not installed — run `npm install`");
	process.exit(1);
}

// Remove stale output from earlier build layouts (for example the Bun-era
// dist/cli.js) so the package ships only the current tsc tree.
rmSync(outdir, { recursive: true, force: true });

const result = spawnSync(process.execPath, [tsc, "-p", join(root, "tsconfig.build.json")], {
	cwd: root,
	stdio: "inherit",
	shell: false,
	windowsHide: true,
});

if (result.error !== undefined) {
	console.error(`build failed: ${result.error.message}`);
	process.exit(1);
}
if (result.status !== 0) {
	process.exit(result.status ?? 1);
}
if (!existsSync(outputPath)) {
	console.error("build failed: dist/cli/index.js was not produced");
	process.exit(1);
}

console.log(`Built ${outputPath}`);
