---
description: Scaffold a new Script Forge workspace in the current project — copy templates, wire lint to the shared plugin config, install dependencies, git init and first commit. Run once per new project.
argument-hint: "[name] [--force]"
user-invocable: true
disable-model-invocation: true
allowed-tools:
- Bash(cp -r ${CLAUDE_PLUGIN_ROOT}/templates/. *)
- Bash(mkdir -p *)
- Bash(mv *)
- Bash(cd ${user_config.scaffoldDirectory} && *)
- Bash(bun install *)
- Bash(git init *)
- Bash(git config --get user.name)
- Bash(git config --get user.email)
- Bash(git add *)
- Bash(git commit *)
- Bash(bun --version)
- Bash(bun run ${CLAUDE_PLUGIN_ROOT}/commands/scripts/doctor-check.ts *)
- Bash(bunx tsc *)
---

# Scaffold a Script Forge workspace

Creates a new tooling workspace in the current project directory: blank templates
copied from the plugin (no example code), lint wired to the shared plugin ESLint
config (never copied into the project), dependencies installed, git initialized
with the first commit. Run **once per new project** — re-running refuses unless
`--force` is given.

## 0. Consent — mandatory

Before any file is written, tell the user exactly what will happen and get
explicit confirmation:
1. template files copied into the target directory (package.json, tsconfig.json, .gitignore, `${user_config.scriptsDirectory}`/ (default scripts), `${user_config.localDirectory}`/ (default local)),
2. `bun install` (network — pulls zod and the eslint toolchain),
3. `git init -b main` plus a first commit.

If the user declines, stop without writing anything. (Consent applies to this
invocation only.)

## 1. Pre-checks

- Target directory: `${user_config.scaffoldDirectory}` if non-empty, else the
  current working directory. Create it with `mkdir -p` if it doesn't exist yet.
- `bun --version` — if Bun is missing, report it and exit 2 (environment).
- If `package.json` already exists in the target and `--force` was NOT given:
  report "already scaffolded" and exit 1 (user).
- Project name: the `name` argument if given, else the basename of the target
  directory, sanitized to kebab-case (lowercase, digits, dashes).

## 2. Copy templates

- If `${user_config.scaffoldDirectory}` is non-empty: `mkdir -p <target>` first,
  then `cp -r ${CLAUDE_PLUGIN_ROOT}/templates/. <target>` — this copies hidden
  files (.gitignore, .gitkeeps) too.
- Rename the layout directories when the config deviates from the defaults
  (strip trailing slashes, compare case-insensitively on Windows; skip the
  rename when the configured name equals the default):
  - if `${user_config.scriptsDirectory}` ≠ `scripts`: `mkdir -p "$(dirname <scriptsDir>)"` (nested names), then `mv scripts <scriptsDir>`.
  - if `${user_config.localDirectory}` ≠ `local`: `mkdir -p "$(dirname <localDir>)"` (nested names), then `mv local <localDir>`.
- Verify all of these landed: `package.json`, `tsconfig.json`, `.gitignore`,
  `<scriptsDir>/.gitkeep`, `<localDir>/tmp/.gitkeep`, `<localDir>/raw_data/.gitkeep`.
- With `--force`: overwrite only the files in the template list; never delete
  or modify anything else in the project.

## 3. Wire the copied files

Read the copied `package.json`, `tsconfig.json`, and `.gitignore` and rewrite
these placeholders (use the Write tool — keep every other field and its
formatting):
- `{{name}}` → the sanitized project name (package.json only).
- `{{eslintConfigPath}}` → `${user_config.esLintConfigLocation}` if non-empty,
  else `${CLAUDE_PLUGIN_ROOT}/skills/anvil/assets/eslint.tooling.js` — with all
  backslashes converted to forward slashes (works on Windows and POSIX). The
  plugin default is the one true config — do NOT copy it into the project; a
  custom config is the user's own file, point at it by path.
- `{{bunPin}}` → `1.3.14` (the pinned runtime; keep in sync with engines.bun).
- `{{scriptsDir}}` → `${user_config.scriptsDirectory}` (fall back to `scripts`).
- `{{localDir}}` → `${user_config.localDirectory}` (fall back to `local`).

## 4. Install

- `bun install` in the target directory (prefix with `cd <target> &&` when the
  target differs from the current working directory). Report the resulting
  dependency versions
  in the summary (names + versions only — never dump lockfile contents).

## 5. Git init + first commit

- `git init -b main` (same `cd <target> &&` prefix when the target differs
  from the current working directory).
- If `git config --get user.name` or `git config --get user.email` returns
  empty: warn that the commit was skipped (identity not configured) and stop
  here — do NOT guess an identity.
- Else: `git add .` then commit `chore: scaffold script-forge workspace`.

## 6. Validation

- Run the doctor deep check: `bun run ${CLAUDE_PLUGIN_ROOT}/commands/scripts/doctor-check.ts <target> ${CLAUDE_PLUGIN_ROOT} ${user_config.esLintConfigLocation} ${user_config.scriptsDirectory} ${user_config.localDirectory}`
  and surface its SUMMARY line.
- Typecheck only if the project has any `.ts` files (a fresh workspace has
  none — `tsc` errors on an empty include set, so skip it then):
  `cd <target> && bunx tsc --noEmit` (`cd` prefix only when the target differs
  from the current working directory).

## 7. Summary

End with a short summary: files created, config path wired, dependencies
installed, git state, doctor result. Exit 0 on success; 1 on user-refused
pre-checks; 2 on environment failures (missing bun/git, install failure);
4 on anything unexpected.
