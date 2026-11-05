# CLAUDE.md

Repository guidance lives in [`AGENTS.md`](AGENTS.md). Read it first.

Claude Code specifics:

- The plugin manifest is `plugins/script-forge/.claude-plugin/plugin.json`;
  the marketplace is `.claude-plugin/marketplace.json` (`glowing-trefoil`).
- Install: `claude plugin install script-forge --marketplace NuclearManatee/glowing-trefoil`.
- Commands appear as `/script-forge:scaffold`, `/script-forge:doctor`, and
  `/script-forge:lint`; they run `npx -y glowing-trefoil ...` and pass
  `userConfig` as `--claude-config-json`.
- Claude `userConfig` values are single-quoted JSON in the generated command;
  values containing single quotes are unsupported.
- Update with `claude plugin update script-forge@glowing-trefoil`.
