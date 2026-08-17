---
description: Lint the project's TypeScript against the shared Script Forge ESLint config (the plugin's single source of truth — never copied into the project).
argument-hint: "[directory] [--fix] [-- <eslint args>]"
user-invocable: true
disable-model-invocation: true
allowed-tools:
- Bash(bunx eslint *)
- Bash(bun add -d *)
---

# Script Forge lint

Lints the project's scripts and temp-tools against the configured ESLint
config: `${user_config.esLintConfigLocation}` if non-empty, else the plugin's
`${CLAUDE_PLUGIN_ROOT}/skills/anvil/assets/eslint.tooling.js`. The plugin
config's imports resolve from the **plugin install's** node_modules — the
project needs the eslint dev-deps installed (check 3), but never its own copy
of the config; a custom config resolves its imports relative to its own
location.

## 1. Locate the project

- Directory: the `[directory]` argument or the current working directory.
  All steps below run with that as the working directory.
- Require a `package.json` there; without one, report and exit 2 (environment).

## 2. No files, no run

- Lint targets are the configured dirs: `${user_config.scriptsDirectory}/**/*.ts`
  (default `scripts/**/*.ts`) and `${user_config.localDirectory}/tmp/**/*.ts`
  (default `local/tmp/**/*.ts`). If neither glob matches any file, report
  "no TypeScript files to lint" and exit 0 (nothing to do is not a failure).
- ESLint 10 hard-fails on globs with no matches (e.g. an empty tmp dir),
  so always pass `--no-error-on-unmatched-pattern`.

## 3. ESLint availability

- Check the project's eslint is installed (e.g. `node_modules/.bin/eslint`).
  If missing: report which of the five eslint dev-deps are absent (eslint,
  @typescript-eslint/eslint-plugin, @typescript-eslint/parser,
  @stylistic/eslint-plugin, eslint-plugin-unicorn), and with explicit user
  consent run `bun add -d` for the missing ones. Never let `bunx` auto-download
  a package without consent.

## 4. Run ESLint

- `bunx eslint --no-error-on-unmatched-pattern --config <config> "<scriptsDir>/**/*.ts" "<localDir>/tmp/**/*.ts"`
  where `<config>` is the path above (forward slashes) and `<scriptsDir>` /
  `<localDir>` are the configured dirs (defaults `scripts`, `local`). Keep the
  globs quoted so ESLint does its own matching — they are relative to the
  project root, which is why this runs with the project as cwd.
- Pass through `--fix` and any `-- <eslint args>`.
- Surface the violations summary; never dump config internals or node_modules
  paths into the output beyond what ESLint prints.

## 5. Exit mapping

- eslint 0 → 0 (clean). eslint 1 → 1 (lint errors found — report them).
- eslint 2 → 2 (config/IO problem — report, suggest `/script-forge:doctor`).
- anything else → 4 (internal).
