# Script Forge

A Claude Code plugin for building **local tooling scripts** — data processing,
file conversion, LLM-powered batch jobs, webhooks, and CLI tools — under the
Script Forge rulebook (`assets/script-forge.md`).

## What you get

**One auto-trigger skill: `anvil`** — the rulebook, split into a map
(`skills/anvil/SKILL.md`) with seven topic references and five real asset files.
When you ask to build or fix a script, anvil loads only the rules it needs and
uses the real files directly:

| Asset | Use |
| --- | --- |
| `eslint.tooling.js` | the one true ESLint config — projects **point** at it, never copy it |
| `stepSchema.ts` + `runner.ts` | step zod schemas + the checkpoint & resume engine (bun:sqlite state, resume, rollback) — scripts copy these into `commons/` |
| `readme.template.md` / `prompt.template.md` | slot shapes for script READMEs and LLM prompt files |

**Three user-invoked commands:**

- `/script-forge:scaffold` — set up a new workspace once: copy templates, wire lint to the shared config, install dependencies, `git init` + first commit.
- `/script-forge:doctor` — environment + project health check (Bun version, installed deps, `.env` presence — never its content).
- `/script-forge:lint` — lint the configured script and temp-tool dirs (defaults `scripts/`, `local/tmp/`) against the configured config (default: the plugin's `eslint.tooling.js`) — with `--fix`.

**Blank templates** — `templates/` ships a skeleton (no example code): `package.json`
(zod + the ESLint toolchain, `engines.bun` pin; tests via built-in `bun test`), `tsconfig.json`,
`.gitignore`, and `scripts/`, `local/tmp/`, `local/raw_data/` folders kept alive
by `.gitkeep` files — renamed and rewired at scaffold time to the configured
`scriptsDirectory` / `localDirectory` (defaults shown).

## Install once, use in every project

The plugin is installed once per machine (user scope — available in every
project); every project it scaffolds **points** at the plugin's eslint config
by absolute path. The config's imports resolve from the plugin install's own
`node_modules` — that is why lint works in any scaffolded project without
copying anything.

```sh
# two steps: register the marketplace, then install the plugin (user scope by default)
/plugin marketplace add https://github.com/NuclearManatee/script-forge.git
/plugin install script-forge@script-forge

# or manual: point Claude Code at the plugin directory
claude --plugin-dir /path/to/script-forge
```

`/plugin install` defaults to user scope — once per machine, enabled in all
projects. If the install summary says so, run `/reload-plugins` (or restart)
to activate. Then, once per new project: `/script-forge:scaffold`.

## Configuration

Plugin-level `userConfig` (set in Claude Code settings; the plugin is fully
functional with defaults — you're never forced through the config dialog):

- `defaultNamespace` (default `tools`) — the `<namespace>:<scriptname>` alias namespace anvil uses.
- `scaffoldDirectory` (default: the current working directory) — absolute path where `/script-forge:scaffold` creates new workspaces.
- `scriptsDirectory` (default `scripts`) — where proper scripts live in a workspace.
- `localDirectory` (default `local`) — the workspace scratch root (`tmp/` and `raw_data/` hang off it).
- `esLintConfigLocation` (default: the plugin's `eslint.tooling.js`, absolute path, forward slashes) — the ESLint config scaffold and lint point at via `--config`. A custom config resolves its imports relative to its own location.
- LLM provider & model for prompt files: **asked at runtime** — when anvil creates a prompt file it asks the user, presenting the current default model per provider (looked up at ask time); there is no config default.

Claude Code prompts for `userConfig` when the plugin is enabled; with defaults
everywhere the dialog is skippable, and the CLI install form never asks. To set
values after install, add a `pluginConfigs` entry to your **user** settings
(`~/.claude/settings.json` — project and local settings are ignored), then run
`/reload-plugins` (or restart):

```json
{
  "pluginConfigs": {
    "script-forge@script-forge": {
      "options": {
        "defaultNamespace": "tools",
        "esLintConfigLocation": ""
      }
    }
  }
}
```

The plugin id is `script-forge@script-forge` (plugin name + marketplace name);
`options` keys are the `userConfig` names above.

## Workspace shape

A scaffolded project is a plain Bun workspace:

```
<project>/
├── scripts/        # proper scripts, built by anvil
├── local/
│   ├── tmp/        # throwaway tools (Temp-tools rule)
│   └── raw_data/   # raw input dumps (No Naked Data rule)
└── package.json    # zod + ESLint toolchain, lint wired to the plugin's config
```

`scripts/` and `local/` are renamed at scaffold time if you configure different
names; the `local/` tree is gitignored.

## A typical session

1. Ask for a script — `anvil` plans, builds, and documents it per the rulebook (frontmatter, diagram, per-step sections).
2. `/script-forge:lint` keeps it clean; `/script-forge:doctor` checks the environment.
3. Multi-step jobs checkpoint into bun:sqlite — an interrupted run resumes where it stopped.

## Requirements

- Bun `1.3.14` (pinned) — the runtime for scripts and the plugin's own tooling.

## Development

Plugin internals, repo layout, and maintenance obligations: `CLAUDE.md`.
