# Script Forge

The `anvil` skill builds and maintains local tooling scripts under the Script
Forge rulebook; the `scaffold`, `doctor`, and `lint` commands manage each
workspace. This folder is the plugin artifact installed by every harness.

## Commands

Install from the collection marketplace:

```sh
/plugin install script-forge --marketplace NuclearManatee/glowing-trefoil
```

| Command | Claude Code / Cowork | Cursor / OpenCode |
| --- | --- | --- |
| Scaffold a workspace | `/script-forge:scaffold` | `/script-forge-scaffold` |
| Health check | `/script-forge:doctor` | `/script-forge-doctor` |
| Lint | `/script-forge:lint` | `/script-forge-lint` |

All three call `npx -y glowing-trefoil <command>` and share the prose in
`commands-src/`. `commands/`, `commands-cursor/`, and `commands-opencode/` are
generated; do not edit them by hand.

## What ships

- `skills/anvil/` — the rulebook map, seven references, and five assets.
- `assets/script-forge.md` — the binding rulebook.
- `assets/eslint.tooling.js` — the rulebook ESLint config; `scaffold` copies it
  into the project so its imports resolve from the project's `node_modules`.
- `templates/` — the blank workspace skeleton.
- `cli/` and `lib/` — the Node-compatible CLI source (bundled to
  `dist/cli.js`).

There is no `bin/`, `package.json`, or `node_modules/` here by design: Cowork
rejects plugins with a top-level `bin/`, and the CLI carries its own
dependencies.

## Configuration

Resolution order: CLI flags, project `.script-forge.json`, Claude `userConfig`,
global `~/.config/script-forge/config.json`, defaults. Inspect the resolved
values and their sources with:

```sh
npx -y glowing-trefoil config
npx -y glowing-trefoil config --json
```

Full contract: `skills/anvil/references/config.md`.

## Troubleshooting

- **Command not found:** reinstall the harness adapter and reload/restart.
  Claude Code: `claude plugin list`. Cursor: re-run
  `npx -y glowing-trefoil install cursor`. OpenCode: re-run
  `npx -y glowing-trefoil install opencode`.
- **`npx` cannot download:** check Node 22+ and network access to the npm
  registry.
- **`scaffold` skipped install:** Bun is missing; install `1.3.14` and run
  `bun install` in the workspace.
- **Lint complains about the config:** the project copy must exist at
  `<project>/eslint.tooling.js` (or set `esLintConfigLocation`); run
  `scaffold --force --yes` or copy the asset.
- **Existing folder not overwritten:** the installer only replaces paths it
  owns; pass `--force` after confirming.
