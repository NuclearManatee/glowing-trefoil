---
name: anvil
description: "Building and maintaining tooling scripts under the Script Forge rulebook. Use whenever the user asks to create, extend, or fix a local tooling script (data processing, file conversion, LLM-powered batch jobs, webhooks, CLI tools) or to investigate data with a script. Covers the full lifecycle: planning, scaffolding, step orchestration with checkpoint & resume, validation, and documentation."
when_to_use: "The user asks to build a script, write a tool, extend an existing script, debug/fix a script, or turn a temp-tool into a proper script. Also triggers on data-investigation work that needs a temp-tool (${user_config.localDirectory}/tmp, default local/tmp) rather than one-off shell commands."
---

# Anvil — Script Forge

This skill is the **map**, not the book. The rulebook lives in the files below; read the ones relevant to the current task on demand — do not front-load them.

## The layout

- `references/` — the rulebook, split by topic. Read what you need:
  - `techStack.md` — Bun+TS, the must-have/pre-authorized dependency lists, the eslint dev-deps group.
  - `config.md` — plugin userConfig: the configurable directories and defaults every other reference's paths refer to (scripts, local/tmp, local/raw_data, scaffold target, eslint config, LLM model).
  - `codeStandards.md` — runtime & architecture (zod at ingress, fail fast, exit-code taxonomy 0/1/2/3/4 + 130, why-comments), logging rules, and where the ESLint rules live.
  - `domainPatterns.md` — Data I/O (raw_data layout, Temporal, memory-conscious ingress), file formats, LLM patterns (surface area, generateObject, rate control, prompt files), networking (hono, ngrok, signatures).
  - `principles.md` — the six principles, to the letter: No Naked Data, Clean Kitchen, Checkpoint & Resume, Eval is Banned, Never Read `.env`, Memory.
  - `lifecycle.md` — temp-tools vs proper scripts, the full script layout, step orchestration, and the Planning → Implementing → Validating → Running phases.
  - `documentation.md` — the required README structure and its sync obligation.

- `assets/` — real files. Use them as-is; never rewrite their content:
  - `eslint.tooling.js` — the one true ESLint config (rulebook verbatim). **Point at it by path** from every project (`--config`); never copy it into a project. The `lint` helper command does this.
  - `stepSchema.ts` — the step zod schemas (`stepContext`, `stepDef`, `stepList`). **Copy** into `${user_config.scriptsDirectory}/<name>/commons/stepSchema.ts`.
  - `runner.ts` — the checkpoint & resume engine: per-run bun:sqlite state DB (WAL), skip done, restart from first pending/failed, orphaned-row confirmation, mark-done-only-after-write, reverse-replay rollback with rollbackFn. **Copy** into `${user_config.scriptsDirectory}/<name>/commons/runner.ts` together with stepSchema.ts, then compose steps in `index.ts` per lifecycle.md → Step Orchestration.
  - `readme.template.md` — the slot shape for a script's README. Fill it when writing `${user_config.scriptsDirectory}/<name>/README.md` (documentation.md explains the requirements).
  - `prompt.template.md` — the slot shape for LLM prompt files under `${user_config.scriptsDirectory}/<name>/assets/prompts/`.

**Copy vs point:** the eslint config is *pointed* to (single source of truth; imports resolve from the plugin install's node_modules — the same reason `lint` never copies it). stepSchema/runner are *copied* because scripts run standalone with their own dependencies. Templates are *filled*, never shipped as-is into a script.

## Your config

- Default namespace for `<namespace>:<scriptname>` aliases: `${user_config.defaultNamespace}` (fall back to `tools` if the value is missing or empty).
- LLM provider & model for prompt files: **no config default** — when creating a prompt file, ask the user, presenting the current default model per provider (looked up at that moment — current model docs / web search — never a stale list or memory).
- Scaffold target directory: `${user_config.scaffoldDirectory}` (fall back to the current working directory if missing or empty).
- Scripts directory: `${user_config.scriptsDirectory}` (fall back to `scripts`).
- Local (scratch) directory: `${user_config.localDirectory}` (fall back to `local`).
- ESLint config location: `${user_config.esLintConfigLocation}` (fall back to the plugin's `skills/anvil/assets/eslint.tooling.js`).

## Working mode

1. **Plan first** when the approach is uncertain or the change spans files — follow lifecycle.md → Planning (research with subagents, AskUserQuestion in ≤2 batches, end with a validation step).
2. **Investigate with scripts, not inline code** — temp-tools in `${user_config.localDirectory}/tmp/`, raw data in `${user_config.localDirectory}/raw_data/` (defaults `local/tmp/`, `local/raw_data/`), stats-only output (No Naked Data).
3. **Scaffold new proper scripts** with the `scaffold` command once per project; new scripts inside an existing project follow lifecycle.md → Scaffolding.
4. **Never read `.env` as a file**; `process.env` only. **Never eval / `bun -e` / Python.**
5. **Validate before done** — lifecycle.md → Validating (tsc, eslint via `lint`, TDD bun test, fixtures follow No Naked Data).
6. **Update the script's README in the same commit** as step/index changes.

## Helper commands

- `/script-forge:scaffold` — one-time project setup: copies templates, wires lint to the shared config, installs, git init + first commit.
- `/script-forge:doctor` — environment + project health check.
- `/script-forge:lint` — lint project scripts against the shared config (also `--fix`).
