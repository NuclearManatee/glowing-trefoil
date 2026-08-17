import config from "./skills/anvil/assets/eslint.tooling.js";

// The plugin's own lint config: the verbatim asset config targets project
// globs (scripts/**, local/tmp/**), but the plugin's only TS source lives in
// commands/scripts/ — remap the files glob for this repo only. The asset
// itself stays untouched so projects always lint against the rulebook verbatim.
export default [
	{
		...config[0],
		files: ["commands/scripts/**/*.ts"],
		rules: {
			...config[0].rules,
			// The spec mandates the file name doctor-check.ts; the rulebook's
			// camelCase-filename rule applies to project scripts, not the
			// plugin's own helper.
			"unicorn/filename-case": "off",
		},
	},
];
