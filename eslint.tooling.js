import config from "./plugins/script-forge/assets/eslint.tooling.js";

// Repo-only wrapper: the verbatim rulebook config targets project globs
// (scripts/**, local/tmp/**); the collection's own TS lives in the plugin
// CLI/lib, scripts/, and tests/, so remap the files glob. The plugin folder
// is kebab-case by design, so filename-case is off for repo code only.
export default [
	{
		...config[0],
		files: ["plugins/*/cli/**/*.ts", "plugins/*/lib/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"],
		rules: {
			...config[0].rules,
			"unicorn/filename-case": "off",
		},
	},
];
