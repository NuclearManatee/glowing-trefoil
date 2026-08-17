# Config

> Source: Script Forge rulebook, **Plugin userConfig**. The user-level keys the plugin reads, what every path in this skill actually means, and how LLM provider/model are chosen.

The plugin reads a few user-level keys from Claude Code settings (the `userConfig` block of the plugin manifest). Unset or empty means "use the default below".

## The keys

* `defaultNamespace` (default `tools`) — the `<namespace>:<scriptname>` alias namespace used when registering scripts in `package.json` (see lifecycle.md → Proper scripts).
* `scaffoldDirectory` (default: the current working directory) — absolute path where the `scaffold` command creates new workspaces.
* `scriptsDirectory` (default `scripts`) — workspace-relative directory where proper scripts live.
* `localDirectory` (default `local`) — workspace-relative scratch root; the `tmp/` (temp-tools) and `raw_data/` (No Naked Data) children hang off it.
* `esLintConfigLocation` (default: the plugin's `skills/anvil/assets/eslint.tooling.js`, resolved from the plugin install root, forward slashes) — absolute path to the ESLint flat config projects point at via `--config`. A custom config resolves its own imports relative to its own location; the plugin-default config resolves them from the plugin install's `node_modules`.

## What every path means

Throughout this skill, `scripts/`, `local/tmp`, `local/raw_data`, and `scripts/<scriptname>/` mean the **configured** directories — they interpolate as `${user_config.scriptsDirectory}`, `${user_config.localDirectory}`, etc., with the defaults above when a key is unset or empty. Code-block examples keep the default names so they stay copy-paste runnable.

## LLM provider & model — asked at runtime

Prompt files carry a `model:` in their frontmatter (see domainPatterns.md → Prompt Files). There is **no config default for provider or model**: when creating a prompt file, ask the user for the provider and the model at that moment, presenting the current default model for each provider — looked up at ask time (current model docs / web search), never a stale baked-in list, never from memory.
