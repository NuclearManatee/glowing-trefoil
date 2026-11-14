# Glowing Trefoil

A personal collection of AI-coding plugins. The first plugin is **Script Forge**:
a rulebook plus workflow commands for building local tooling scripts — data
processing, file conversion, LLM-powered batch jobs, webhooks, and CLI tools.

Works in **Claude Code**, **Claude Cowork**, **Cursor**, and **OpenCode** from
one shared codebase.

## Plugins

| Plugin | What it does |
| --- | --- |
| `script-forge` | The `anvil` skill (the rulebook) and the `scaffold`, `doctor`, `lint` commands. |

## Install

Each harness has one install path that uses its native surface. Full steps,
updates, uninstalls, and verification: [`docs/install.md`](docs/install.md).

| Harness | Install |
| --- | --- |
| Claude Code | `claude plugin install script-forge --marketplace NuclearManatee/glowing-trefoil` |
| Cowork | Customize → Plugins → Add marketplace → `NuclearManatee/glowing-trefoil` → Install `script-forge` |
| Cursor | `npx -y glowing-trefoil install cursor`, then reload the window |
| OpenCode | `npx -y glowing-trefoil install opencode`, then restart |

There is no `install --all`: Cowork and Cursor cannot be installed
non-interactively, and each harness expects software to arrive its own way.

## What you get

**One auto-trigger skill, `anvil`** — the rulebook as a map with seven topic
references and five real assets. When you ask to build or fix a script, anvil
loads only the rules it needs.

**Three user-invoked commands**, available as `/script-forge:<name>` in
Claude Code and Cowork, `/script-forge-<name>` in Cursor and OpenCode:

- `scaffold` — create a workspace once: templates, a project-local ESLint
  config, dependencies, optional `git init` and first commit.
- `doctor` — Node/Bun runtime, `engines.bun` pin, dependencies, `.env`
  presence (never contents), folder layout, ESLint config, git state.
- `lint` — run ESLint against the project-local config; `--fix` with consent.

**Blank templates** — `package.json` (zod + the ESLint toolchain, `engines.bun`
pin), `tsconfig.json`, `.gitignore`, and the `scripts/`, `local/tmp/`,
`local/raw_data/` folders.

## Configuration

The plugin works with defaults. Resolution order, highest first:

1. CLI flags.
2. Project `.script-forge.json`.
3. Claude Code `userConfig` (passed by the generated Claude command).
4. Global `~/.config/script-forge/config.json`.
5. Defaults.

| Key | Default | Meaning |
| --- | --- | --- |
| `defaultNamespace` | `tools` | `tools:<scriptname>` alias namespace |
| `scaffoldDirectory` | cwd | where `scaffold` creates workspaces |
| `scriptsDirectory` | `scripts` | workspace-relative proper-scripts directory |
| `localDirectory` | `local` | workspace-relative scratch root |
| `esLintConfigLocation` | `<project>/eslint.tooling.js` | custom ESLint flat config |

Empty values fall through. Slash-separated directories must stay inside the
workspace. See [`plugins/script-forge/skills/anvil/references/config.md`](plugins/script-forge/skills/anvil/references/config.md).

## Requirements

- **Runtime:** Node 22+ (the CLI and every generated command).
- **Workspaces:** Bun `1.3.14` (pinned by the generated `package.json`).
- **Development:** Bun `1.3.14` for building, testing, and bundling.

Cowork has Node and npm but not guaranteed Bun. `scaffold` still creates the
workspace and skips `bun install`, printing the exact command to run later;
`doctor` reports the missing Bun as a failure because the generated workspace
is Bun-based.

## Development

```sh
bun install
bun run lint
bun run typecheck
bun test
bun run validate
bun run build:commands
bun run build
```

- `bun run build:commands` regenerates the three command adapters from
  `plugins/script-forge/commands-src/`. Generated files are committed; CI fails
  on drift.
- `bun run build` bundles `dist/cli.js` for Node; it is gitignored and built by
  `prepack`.
- Layout rules and maintenance obligations: [`AGENTS.md`](AGENTS.md).

## Release history

See [`CHANGELOG.md`](CHANGELOG.md).

## License

MIT — see [`LICENSE`](LICENSE).
