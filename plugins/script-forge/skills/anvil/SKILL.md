---
name: anvil
description: "Building and maintaining tooling scripts under the Script Forge rulebook. Use whenever the user asks to create, extend, or fix a local tooling script (data processing, file conversion, LLM-powered batch jobs, webhooks, CLI tools) or to investigate data with a script. Covers the full lifecycle: planning, scaffolding, step orchestration with checkpoint & resume, validation, and documentation. Also triggers on data-investigation work that needs a temp-tool (<localDir>/tmp, default local/tmp) rather than one-off shell commands."
---

# Anvil — Script Forge

This skill is the **map**, not the book. The rulebook lives in the files below; read the ones relevant to the current task on demand — do not front-load them.

## The layout

- `references/` — the rulebook, split by topic. Read what you need:
  - `techStack.md` — Bun+TS, the must-have/pre-authorized dependency lists, the eslint dev-deps group.
  - `config.md` — how configuration is resolved: the configurable directories and defaults every other reference's paths refer to (scripts, local/tmp, local/raw_data, scaffold target, eslint config, LLM model).
  - `codeStandards.md` — runtime & architecture (zod at ingress, fail fast, exit-code taxonomy 0/1/2/3/4 + 130, why-comments), logging rules, and where the ESLint rules live.
  - `domainPatterns.md` — Data I/O (raw_data layout, Temporal, memory-conscious ingress), file formats, LLM patterns (surface area, generateObject, rate control, prompt files), networking (hono, ngrok, signatures).
  - `principles.md` — the six principles, to the letter: No Naked Data, Clean Kitchen, Checkpoint & Resume, Eval is Banned, Never Read `.env`, Memory.
  - `lifecycle.md` — temp-tools vs proper scripts, the full script layout, step orchestration, and the Planning → Implementing → Validating → Running phases.
  - `documentation.md` — the required README structure and its sync obligation.

- `assets/` — real files. Use them as-is; never rewrite their content:
  - `eslint.tooling.js` — the one true ESLint config (rulebook verbatim). `scaffold` copies it into each project as `<project>/eslint.tooling.js`; the project copy's imports resolve from the project's own `node_modules`. Never hand-edit the project copy; the plugin asset is the source of truth.
  - `stepSchema.ts` — the step zod schemas (`stepContext`, `stepDef`, `stepList`). **Copy** into `<scriptsDir>/<name>/commons/stepSchema.ts`.
  - `runner.ts` — the checkpoint & resume engine: per-run bun:sqlite state DB (WAL), skip done, restart from first pending/failed, orphaned-row confirmation, mark-done-only-after-write, reverse-replay rollback with rollbackFn. **Copy** into `<scriptsDir>/<name>/commons/runner.ts` together with stepSchema.ts, then compose steps in `index.ts` per lifecycle.md → Step Orchestration.
  - `readme.template.md` — the slot shape for a script's README. Fill it when writing `<scriptsDir>/<name>/README.md` (documentation.md explains the requirements).
  - `prompt.template.md` — the slot shape for LLM prompt files under `<scriptsDir>/<name>/assets/prompts/`.

**Copy vs point:** `eslint.tooling.js` is copied into the project once by `scaffold`; that project copy is the lint target and resolves its imports from the project's `node_modules`. stepSchema/runner are *copied* because scripts run standalone with their own dependencies. Templates are *filled*, never shipped as-is into a script.

## Your config

Read `references/config.md` for the full contract. Resolution order, highest to
lowest: CLI flags, project `.script-forge.json`, Claude `userConfig`, global
`~/.config/script-forge/config.json`, defaults. Empty values fall through.

Throughout this skill:

- `<namespace>` — default `tools`; used for `<namespace>:<scriptname>` aliases.
- `<scriptsDir>` — default `scripts`.
- `<localDir>` — default `local` (with `tmp/` and `raw_data/` children).
- `<eslintConfig>` — default `<project>/eslint.tooling.js`.
- Scaffold target — default the current working directory.

LLM provider & model for prompt files: **no config default** — when creating a
prompt file, ask the user, presenting the current default model per provider
(looked up at that moment — current model docs / web search — never a stale list
or memory).

## Working mode

1. **Plan first** when the approach is uncertain or the change spans files — follow lifecycle.md → Planning (research with subagents, ask the user in ≤2 batches, end with a validation step).
2. **Investigate with scripts, not inline code** — temp-tools in `<localDir>/tmp/`, raw data in `<localDir>/raw_data/` (defaults `local/tmp/`, `local/raw_data/`), stats-only output (No Naked Data).
3. **Scaffold new proper scripts** with the scaffold command once per project; new scripts inside an existing project follow lifecycle.md → Scaffolding.
4. **Never read `.env` as a file**; `process.env` only. **Never eval / `bun -e` / Python.**
5. **Validate before done** — lifecycle.md → Validating (tsc, eslint via lint, TDD bun test, fixtures follow No Naked Data).
6. **Update the script's README in the same commit** as step/index changes.

## Helper commands

- Claude Code / Cowork: `/script-forge:scaffold`, `/script-forge:doctor`, `/script-forge:lint`.
- Cursor / OpenCode: `/script-forge-scaffold`, `/script-forge-doctor`, `/script-forge-lint`.

The scaffold command creates the workspace, copies the ESLint config, installs
dependencies, and optionally initializes git. The doctor command checks the
environment and project. The lint command runs ESLint against the project-local
config and supports `--fix`.
