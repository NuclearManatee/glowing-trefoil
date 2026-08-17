---
description: Check the Script Forge environment and project health — Bun runtime, engines.bun pin, installed dependencies, .env presence, folder layout, git state.
argument-hint: "[directory]"
user-invocable: true
disable-model-invocation: true
allowed-tools:
- Bash(bun --version)
- Bash(bun run ${CLAUDE_PLUGIN_ROOT}/commands/scripts/doctor-check.ts *)
---

# Script Forge doctor

Health check for the Script Forge environment and the current (or given)
project. Two stages: a quick shell check for Bun, then the deep check in the
plugin's Bun script.

## 1. Bun runtime

- `bun --version`. If it fails: report that Bun is missing, suggest installing
  the pinned version (1.3.14), and exit 2 (environment).

## 2. Deep check

- Run: `bun run ${CLAUDE_PLUGIN_ROOT}/commands/scripts/doctor-check.ts <dir> ${CLAUDE_PLUGIN_ROOT} ${user_config.esLintConfigLocation} ${user_config.scriptsDirectory} ${user_config.localDirectory}`
  where `<dir>` is the `[directory]` argument or the current working directory.
  Empty config/path values fall back inside the script: config → the plugin
  asset, scripts-dir → `scripts`, local-dir → `local`.
- Pass the output through verbatim — the script prints plain `[PASS]/[WARN]/
  [FAIL]` lines and a `SUMMARY` line.

## 3. Result

- Exit 0: healthy — summarize the SUMMARY line and stop.
- Exit 2: one or more FAILs — report each FAIL and offer the fix from its
  message (e.g. `bun add -d <pkg>`). Do not auto-install without consent.
- Any other exit: report as unexpected and exit 4 (internal).
