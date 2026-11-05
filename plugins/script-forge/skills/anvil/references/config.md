# Config

> Source: Script Forge rulebook, **Configuration**. How the plugin resolves
> settings, what every path in this skill means, and how LLM provider/model are
> chosen.

The plugin reads configuration from five layers. Highest priority wins; an
empty string means "use the next layer".

1. CLI flags (`--default-namespace`, `--scaffold-directory`, etc.).
2. Project `.script-forge.json` in the workspace being operated on.
3. Claude `userConfig`, passed by the generated Claude Code/Cowork command as
   `--claude-config-json`.
4. Global `~/.config/script-forge/config.json`.
5. Built-in defaults.

Cursor and OpenCode commands use only the portable layers (project, global,
defaults). They do not pass Claude `userConfig`.

## The keys

| Key | Default | Meaning |
| --- | --- | --- |
| `defaultNamespace` | `tools` | `<namespace>:<scriptname>` alias namespace used in `package.json` (see lifecycle.md → Proper scripts). |
| `scaffoldDirectory` | empty = current working directory | Absolute path where the scaffold command creates new workspaces. |
| `scriptsDirectory` | `scripts` | Workspace-relative directory where proper scripts live. |
| `localDirectory` | `local` | Workspace-relative scratch root; the `tmp/` (temp-tools) and `raw_data/` (No Naked Data) children hang off it. |
| `esLintConfigLocation` | empty = `<project>/eslint.tooling.js` | Absolute path to a custom ESLint flat config. Empty means use the project-local copy that scaffold writes. |

## Portable config

Project file — commit it when the project needs non-default directories:

```json
{
  "defaultNamespace": "tools",
  "scriptsDirectory": "scripts",
  "localDirectory": "local"
}
```

Global file — machine-wide defaults:

```json
{
  "defaultNamespace": "tools",
  "scaffoldDirectory": "~/dev"
}
```

The same keys work in Claude Code's `userConfig` block; Claude Code passes them
to the CLI. The plugin is fully functional with defaults and never forces a
config dialog.

## Path rules

- `scriptsDirectory` and `localDirectory` are workspace-relative. Absolute
  paths and `..` escapes are rejected.
- `scaffoldDirectory` and `esLintConfigLocation` are absolute paths; `~` is
  expanded. Forward slashes are used when they are written into `package.json`.
- `scaffold` renames the template `scripts/` and `local/` folders when the
  configured names differ; nested names create their parent directories.
- The resolved config is available with `glowing-trefoil config --json`; each
  value includes the layer it came from.

## ESLint config

- `scaffold` copies the plugin asset `assets/eslint.tooling.js` to
  `<project>/eslint.tooling.js` when `esLintConfigLocation` is empty.
- The project copy is the lint target. Its imports resolve from the project's
  `node_modules`, so every scaffolded project installs the ESLint toolchain.
- When `esLintConfigLocation` is set, scaffold does not copy the shared config;
  `package.json` points at the custom absolute path. The custom config resolves
  its own imports relative to its own location.
- `lint` resolves: `--eslint-config` flag, then `esLintConfigLocation`, then
  `<project>/eslint.tooling.js`. Missing config is an environment error with a
  fix suggestion; it never silently downloads packages.

## What every path means

Throughout this skill, `scripts/`, `local/tmp`, `local/raw_data`, and
`scripts/<scriptname>/` mean the **configured** directories. The prose uses
`<scriptsDir>`, `<localDir>`, and `<namespace>` placeholders. Code-block
examples keep the default names so they stay copy-paste runnable.

## LLM provider & model — asked at runtime

Prompt files carry a `model:` in their frontmatter (see domainPatterns.md →
Prompt Files). There is **no config default for provider or model**: when
creating a prompt file, ask the user for the provider and the model at that
moment, presenting the current default model for each provider — looked up at
ask time (current model docs / web search), never a stale baked-in list, never
from memory.
