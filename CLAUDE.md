# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Communication Rules
- Be direct, concise, and straight to the point.
- The answer to my question should be in the first 1-2 lines.
- Ground your vocabulary in the project language, no new jargon without explaining it.
- Skip fillers: no plesantries, introductions, conclusions.
- A bullet point list is better than a wall of text.
- No apologies or yapping whatsoever.

# What this repo is

The **Script Forge plugin itself** — not a Script Forge workspace. It ships the `anvil` skill (the rulebook) plus three slash commands and blank templates. Installed once per machine; every scaffolded project *points at* this plugin's config instead of copying it.

Binding document (do not deviate from it; the first build was rejected for doing so):
- `assets/script-forge.md` — the full rulebook that `anvil` enforces on built scripts.

# Commands (plugin repo)

Runtime is Bun, pinned to `1.3.14` (`engines.bun`).

- `bun install` — install plugin dev deps (eslint toolchain, typescript, zod).
- `bun run lint` — `eslint -c eslint.tooling.js commands/scripts/**/*.ts` (the only TS in the plugin repo).
- `bun run typecheck` — `tsc --noEmit` (tsconfig includes `commands/scripts/**/*.ts` only).
- No tests exist in the plugin repo; don't invent a test command.

# Layout

- `.claude-plugin/plugin.json` — manifest: name, version, description, `userConfig` (`defaultNamespace`, `scaffoldDirectory`, `scriptsDirectory`, `localDirectory`, `esLintConfigLocation`). Nothing else lives here.
- `assets/script-forge.md` — the rulebook, binding authority; the anvil references are cut from it.
- `skills/anvil/SKILL.md` — the map, not the book: trigger conditions, copy-vs-point rules, working mode.
- `skills/anvil/references/` — the rulebook cut into seven topic files (techStack, codeStandards, config, domainPatterns, principles, lifecycle, documentation). Each section of `assets/script-forge.md` maps to exactly one reference. Read on demand, don't front-load.
- `skills/anvil/assets/` — real files, never rewrite content:
  - `eslint.tooling.js` — the one true ESLint config. Projects **point at it by path**; never copy it.
  - `stepSchema.ts` + `runner.ts` — scripts **copy** these into their own `commons/` (checkpoint & resume engine on bun:sqlite).
  - `readme.template.md` / `prompt.template.md` — **filled**, never shipped as-is.
- `commands/` — `scaffold.md`, `doctor.md`, `lint.md` (user-invoked slash commands, each with an allowed-tools block) + `commands/scripts/doctor-check.ts` (the plugin's only TS).
- `templates/` — blank workspace skeleton (no example code) copied by scaffold; placeholders `{{name}}`, `{{eslintConfigPath}}`, `{{bunPin}}`, `{{scriptsDir}}`, `{{localDir}}` are rewritten by scaffold, not by hand.
  - internals: `tsconfig.json` is strict TypeScript for Bun; `.gitignore` ignores `local/tmp` and `local/raw_data`; `.gitkeep` files keep the empty folders alive in git. `scripts/` and `local/` are renamed at scaffold time to the configured directories when they differ.
- `local/scratch-proj/` — a scaffolded test workspace, not part of the plugin. Don't treat it as the plugin's own project.

# Maintenance obligations

When `assets/script-forge.md` changes, re-cut:
- `skills/anvil/references/*.md` — keep in sync with their rulebook sections.
- `skills/anvil/assets/eslint.tooling.js` — must stay byte-identical to the rulebook's config block.

Then bump `version` in `.claude-plugin/plugin.json`. Keep `bunPin` (1.3.14) in sync across `templates/package.json`, `package.json`, and the scaffold command.
