# Glowing Trefoil — plugin collection refactor plan

Status: approved (install DX revised 2026-11-04)
Date: 2026-11-03
Revised: 2026-11-04
Owner: NuclearManatee
Supersedes: the install and packaging sections of the 2026-11-03 revision
Companion: `docs/plans/2026-11-04-install-dx-proposal.md`, `docs/adr/0001-plugin-collection-layout.md`

## 1. Goal

Turn this repository from a single Claude Code plugin into a personal collection of AI-coding plugins:

- Collection / marketplace name: `glowing-trefoil`.
- First plugin: `script-forge` (plugin id unchanged).
- Clients: Claude Code, Claude Cowork, Cursor, OpenCode.
- One shared plugin source, one shared CLI, one shared set of command sources.
- Workflow entry points stay **commands**; each client gets a generated adapter.
- Plugin logic moves out of command prose into a Node-compatible CLI built from Bun/TypeScript.
- Each harness gets one install path that uses that harness's native surface.

Hard constraints:

- No universal `install --all` command.
- No global `bun link`; a command must work after the harness install alone.
- No top-level `bin/` inside the plugin. Cowork and chat reject such a plugin.
- No plugin `node_modules` and no plugin `package.json`.
- Generated command files are committed; CI regenerates them and fails on drift.
- Windows and Linux are both first-class.

## 2. Decisions

| Decision | Choice |
| --- | --- |
| Collection / marketplace name | `glowing-trefoil` |
| Plugin id | `script-forge` |
| Distribution | One npm package `glowing-trefoil` containing the plugin folder and `dist/cli.js` |
| Command execution | `npx -y glowing-trefoil <command>` |
| Claude Code install | `claude plugin install script-forge --marketplace NuclearManatee/glowing-trefoil` |
| Cowork install | Customize → Plugins → Add marketplace → `NuclearManatee/glowing-trefoil` → Install |
| Cursor install | `npx -y glowing-trefoil install cursor`, then reload |
| OpenCode install | `npx -y glowing-trefoil install opencode`, then restart |
| Config | Claude `userConfig` + portable JSON; CLI > project > Claude > global > defaults |
| Workflow logic | Node 22+ CLI, written in TypeScript and bundled by Bun |
| Development / build runtime | Bun `1.3.14` |
| Tests | Bun test runner |
| Verification | `bun run validate`, `bun run build:commands`, CI on Windows + Linux, per-harness install checks |
| License | MIT |
| Plugin version | `1.0.0` |

Why `npx`:

- Node 22+ is present in Cowork and normal for Claude Code, Cursor, and OpenCode users.
- Bun is not guaranteed in the Cowork sandbox; `npx` is.
- It removes the global `bun link` seam and the plugin `node_modules` problem.
- The CLI carries its own dependencies; the plugin needs no package manifest.

## 3. Assumptions

1. The GitHub repository will be renamed `NuclearManatee/script-forge` → `NuclearManatee/glowing-trefoil`.
   - `glowing-trefoil` is free as a GitHub repo/user and as an npm package (checked 2026-11-04).
2. A one-time reinstall is acceptable after the restructure; no dual-layout compatibility shim.
3. `anvil` stays auto-triggered; `scaffold`, `doctor`, and `lint` stay user-invoked commands.
4. No hooks, MCP servers, or agents in v1. Skills and commands are the portability floor.
5. `plugins/script-forge/assets/script-forge.md` remains the rulebook source of truth; the seven `skills/anvil/references/` files stay hand-cut and are checked for drift.
6. Generated command files are committed so marketplace installs work without a build step.
7. Cowork loads the same `.claude-plugin` artifact as Claude Code, never prompts for `userConfig`, and may not have Bun. Portable JSON and real defaults are required.
8. Cursor loads the plugin from `~/.cursor/plugins/local/script-forge/`; its `.cursor-plugin/plugin.json` points at the Cursor command adapter.
9. OpenCode has no command marketplace; its native surface is markdown commands plus Agent Skills in the config directories.
10. The npm package is allowed to include the plugin folder; the plugin folder must not include executables.

## 4. Target layout

```text
glowing-trefoil/
├── AGENTS.md
├── CLAUDE.md                                  # pointer to AGENTS.md
├── README.md                                  # collection catalog + install matrix
├── LICENSE                                    # MIT
├── package.json                               # npm package: glowing-trefoil
├── tsconfig.json
├── bun.lock
├── .gitignore                                 # adds dist/, *.tgz
├── .claude-plugin/
│   └── marketplace.json                       # name: glowing-trefoil
├── .cursor-plugin/
│   └── marketplace.json                       # alternative Cursor marketplace
├── .github/workflows/ci.yml
├── docs/
│   ├── adr/0001-plugin-collection-layout.md
│   ├── install.md                             # per-harness install guide
│   └── plans/
│       ├── 2026-11-03-glowing-trefoil-refactor.md
│       └── 2026-11-04-install-dx-proposal.md
├── scripts/
│   ├── validate.ts                            # manifest/skill/command validator
│   ├── buildCommands.ts                       # commands-src → three adapters
│   └── buildCli.ts                            # Bun build → dist/cli.js, shebang
├── tests/
│   ├── config.test.ts
│   ├── scaffold.test.ts
│   ├── doctor.test.ts
│   ├── lint.test.ts
│   ├── commands.test.ts
│   ├── install.test.ts
│   └── validate.test.ts
├── dist/cli.js                                # built artifact, gitignored
└── plugins/
    └── script-forge/
        ├── .claude-plugin/plugin.json         # Claude Code + Cowork, userConfig
        ├── .cursor-plugin/plugin.json         # Cursor
        ├── README.md
        ├── commands-src/                      # single source for command prose
        │   ├── scaffold.md
        │   ├── doctor.md
        │   └── lint.md
        ├── commands/                          # generated: Claude + Cowork
        │   ├── scaffold.md
        │   ├── doctor.md
        │   └── lint.md
        ├── commands-cursor/                   # generated: Cursor
        │   ├── scaffold.md
        │   ├── doctor.md
        │   └── lint.md
        ├── commands-opencode/                 # generated: OpenCode
        │   ├── script-forge-scaffold.md
        │   ├── script-forge-doctor.md
        │   └── script-forge-lint.md
        ├── skills/anvil/
        │   ├── SKILL.md
        │   ├── references/*.md
        │   └── assets/                        # stepSchema.ts, runner.ts, templates
        ├── assets/
        │   ├── script-forge.md                # rulebook
        │   └── eslint.tooling.js              # single copy; scaffold copies it
        ├── templates/                         # workspace skeleton
        ├── cli/
        │   └── index.ts                       # dispatcher, Node-compatible
        └── lib/
            ├── config.ts
            ├── paths.ts
            ├── scaffold.ts
            ├── doctor.ts
            ├── lint.ts
            ├── install.ts
            └── commands.ts
```

Deliberate omissions:

- No root `plugin.json` Agent Plugins manifest. Cursor uses `.cursor-plugin/plugin.json`; a second manifest invites format ambiguity, and Agent Plugins does not cover commands.
- No `plugins/script-forge/package.json`.
- No `plugins/script-forge/bin/`.
- No plugin `node_modules`.
- No global `script-forge` binary and no stable package copy.

## 5. Install contract

| Harness | Install step | Updates | Uninstall |
| --- | --- | --- | --- |
| Claude Code | `claude plugin install script-forge --marketplace NuclearManatee/glowing-trefoil` | `claude plugin update script-forge@glowing-trefoil` | `claude plugin uninstall script-forge@glowing-trefoil` |
| Cowork | Customize → Plugins → Add → Add marketplace → `NuclearManatee/glowing-trefoil` → Install `script-forge` | Customize → Plugins | Customize → Plugins |
| Cursor | `npx -y glowing-trefoil install cursor`, then reload window | Re-run the install command | `npx -y glowing-trefoil uninstall cursor` |
| OpenCode | `npx -y glowing-trefoil install opencode`, then restart | Re-run the install command | `npx -y glowing-trefoil uninstall opencode` |

### 5.1 Claude Code

- Requires Claude Code `2.1.292` or later (local version is `2.1.302`).
- Installs at user scope by default.
- The shell install does not prompt for `userConfig`; manifest defaults apply.
- To change values later: `/plugin configure script-forge@glowing-trefoil`.
- Verify: `/script-forge:scaffold` appears.

### 5.2 Cowork

1. Open Customize → Plugins.
2. Choose Add → Add marketplace.
3. Enter `NuclearManatee/glowing-trefoil`.
4. Install `script-forge`.

The same root `.claude-plugin/marketplace.json` and `plugins/script-forge/.claude-plugin/plugin.json` serve Claude Code and Cowork. The plugin has no top-level `bin/`.

Cowork behavior:

- `userConfig` is not prompted; manifest defaults apply.
- Project overrides go in `.script-forge.json` in the connected folder.
- The sandbox has Node/npm and an allowlisted npm registry, so `npx -y glowing-trefoil ...` works.
- Bun is not guaranteed. `scaffold` therefore creates files and skips `bun install` when Bun is absent, printing the exact next command. `doctor` reports the missing Bun as a FAIL because the generated workspace is Bun-based.

### 5.3 Cursor

```sh
npx -y glowing-trefoil install cursor
```

Then Command Palette → Developer: Reload Window.

What it does:

- Copies `plugins/script-forge/` to `~/.cursor/plugins/local/script-forge/`.
- Writes a marker file `.glowing-trefoil.json` inside that folder.
- Replaces only that folder; other local plugins are untouched.
- Refuses to overwrite a folder without the marker unless `--force` is passed.

Why this is native: `~/.cursor/plugins/local` is Cursor's documented local plugin surface. It avoids the UI-only marketplace install and works cross-platform without symlinks.

Alternative for sharing:

```sh
cursor-agent plugin marketplace add https://github.com/NuclearManatee/glowing-trefoil
```

Then install `script-forge` from Customize or `/plugin`. Cursor has no non-interactive plugin install command.

Verify: `/script-forge-scaffold` appears and the `anvil` skill is listed.

### 5.4 OpenCode

```sh
npx -y glowing-trefoil install opencode
```

Then restart OpenCode.

What it does:

- Copies `commands-opencode/script-forge-*.md` to `~/.config/opencode/commands/`.
- Copies `skills/anvil/` to `~/.agents/skills/anvil/`.
- Does not edit `opencode.json(c)`.
- Replaces only files it owns; each generated command carries a `<!-- generated by glowing-trefoil -->` marker, and the skill folder carries `.glowing-trefoil.json`.

Verify: `/script-forge-scaffold` is registered and `@anvil` is discoverable.

## 6. Config contract

Keys, same names as today:

| Key | Default | Meaning |
| --- | --- | --- |
| `defaultNamespace` | `tools` | `<namespace>:<scriptname>` alias namespace |
| `scaffoldDirectory` | empty = cwd | absolute path where scaffold creates workspaces |
| `scriptsDirectory` | `scripts` | workspace-relative proper-scripts directory |
| `localDirectory` | `local` | workspace-relative scratch root (`tmp/`, `raw_data/`) |
| `esLintConfigLocation` | empty = `<project>/eslint.tooling.js` | absolute path to the ESLint flat config |

Resolution order, highest to lowest:

1. Explicit CLI flags.
2. Project `.script-forge.json` in the target project.
3. Claude `userConfig`, passed by the generated Claude command as `--claude-config-json`.
4. Global `~/.config/script-forge/config.json`.
5. Defaults.

Rules:

- Empty strings mean "use the next layer".
- `scriptsDirectory` and `localDirectory` are workspace-relative; reject absolute paths and `..` escapes.
- `scaffoldDirectory` and `esLintConfigLocation` are absolute; expand `~`; normalize to forward slashes when emitted into `package.json`.
- `config --json` prints the resolved values and the source of each value.
- `anvil` uses the same resolver; `references/config.md` documents both Claude and portable paths.

ESLint config rule:

- `scaffold` copies `plugins/script-forge/assets/eslint.tooling.js` to `<project>/eslint.tooling.js` when `esLintConfigLocation` is empty.
- The copied config's imports resolve from the **project's** `node_modules`.
- When `esLintConfigLocation` is set, scaffold does not copy the shared config; `package.json` points at the custom absolute path.
- The plugin asset remains the source of truth; the project copy is a pinned build artifact.

## 7. CLI contract

`package.json`:

```json
{
  "name": "glowing-trefoil",
  "version": "1.0.0",
  "type": "module",
  "bin": { "glowing-trefoil": "./dist/cli.js" },
  "files": ["dist", "plugins/script-forge", "README.md", "LICENSE"],
  "engines": { "node": ">=22" },
  "scripts": {
    "lint": "eslint -c eslint.tooling.js --no-error-on-unmatched-pattern \"plugins/**/*.ts\" \"scripts/**/*.ts\" \"tests/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "validate": "bun run scripts/validate.ts",
    "build:commands": "bun run scripts/buildCommands.ts",
    "build": "bun run scripts/buildCli.ts",
    "prepack": "bun run build"
  }
}
```

Build and runtime split:

- Build with Bun; run with Node 22+.
- `scripts/buildCli.ts` uses `Bun.build` with `target: "node"`, bundles `zod`, and ensures `dist/cli.js` starts with `#!/usr/bin/env node`.
- No Bun APIs in `cli/` or `lib/`; use `node:fs`, `node:path`, `node:child_process`, `node:util`.
- All subprocesses use array arguments and `shell: false`. No `cp`, `mv`, `mkdir -p`, `cd &&`.

Subcommands:

| Command | Behavior |
| --- | --- |
| `scaffold [name]` | Create a workspace. Flags: `--target`, `--force`, `--yes`, `--no-install`, `--no-git`, `--json`. |
| `doctor [dir]` | Health check. Flags: `--json`. |
| `lint [dir]` | Run ESLint. Flags: `--fix`, `--eslint-config`, `-- <eslint args>`, `--json`. |
| `config` | Print resolved config. Flag: `--json`. |
| `install cursor\|opencode` | Copy the harness adapter. Flag: `--force`. |
| `uninstall cursor\|opencode` | Remove only marker-owned files. |
| `version` | Print the package version. |
| `help` | Print usage. |

Exit taxonomy: `0` success, `1` user/input, `2` environment, `3` external command failure, `4` internal, `130` SIGINT.

Scaffold behavior:

- Target: `--target`, else `scaffoldDirectory`, else cwd. Create nested parents.
- Name: positional argument, else the target basename sanitized to kebab-case.
- Refuse an existing `package.json` without `--force`; write nothing before that check.
- Copy templates recursively, including nested folders. The template `.gitignore` ships as `templates/gitignore` (npm strips dotfiles from packages) and is renamed to `.gitignore` on copy.
- Rename `scripts/` and `local/` when configured names differ; create nested parents.
- Rewrite `{{name}}`, `{{eslintConfigPath}}`, `{{bunPin}}`, `{{scriptsDir}}`, `{{localDir}}`.
- Copy `eslint.tooling.js` unless a custom config is configured.
- Run `bun install` only when Bun is on PATH and `--no-install` is absent. If Bun is missing, skip with a WARN and print `bun install`.
- Run `git init -b main` unless `--no-git`; commit only when `user.name` and `user.email` are set. Never guess identity.
- Finish with a summary and the doctor summary.

Doctor behavior:

- Node version (must satisfy `>=22`).
- Bun presence and version against the pinned `engines.bun`.
- Project `package.json`, `engines.bun` pin.
- Declared and installed ESLint toolchain + `zod`.
- `.env` presence only; never read contents.
- Folder layout (`scripts/`, `local/tmp/`, `local/raw_data/`).
- Project `eslint.tooling.js` or the configured custom config.
- Git state.
- Output `[PASS]/[WARN]/[FAIL]` + `SUMMARY`; exit `0` when no FAIL, `2` when any FAIL.

Lint behavior:

- Require the project `package.json`.
- Resolve config: `--eslint-config` > `esLintConfigLocation` > `<project>/eslint.tooling.js`. Missing config → exit `2` with the fix.
- Resolve ESLint at `<project>/node_modules/eslint/bin/eslint.js`. Missing deps → exit `2`, print the exact `bun add -d` command, never auto-install.
- Run `process.execPath` + the ESLint bin + `--no-error-on-unmatched-pattern` + `--config` + the configured globs.
- Pass through `--fix` and extra ESLint args.
- Map ESLint `0/1/2` → `0/1/2`; anything else → `4`.

Installer behavior:

- Preflight every target before writing. If any target exists without a glowing-trefoil marker and `--force` is absent, exit `1` without partial writes.
- Cursor target: `~/.cursor/plugins/local/script-forge/`.
- OpenCode targets: `~/.config/opencode/commands/script-forge-{scaffold,doctor,lint}.md` and `~/.agents/skills/anvil/`.
- Copy with `fs.cp`; no symlinks.
- Write markers with package name, plugin name, and version.
- Uninstall removes only marker-owned paths; it never deletes a directory it cannot prove it owns.
- Summarize every write.

## 8. Command generation

One source per command in `commands-src/`. The generator emits three adapters. Only frontmatter and the invocation line differ; the workflow prose is shared.

Source file shape:

```markdown
---
title: Scaffold a Script Forge workspace
description: Create a new Script Forge workspace in the current project.
argument-hint: "[name] [--force]"
---

## 1. Consent — mandatory
...

## 2. Run
{{invocation}}

## 3. Report
...
```

Claude + Cowork adapter (`commands/<name>.md`):

```markdown
---
description: Create a new Script Forge workspace
argument-hint: "[name] [--force]"
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash(npx:*)
---

Run:
npx -y glowing-trefoil scaffold $ARGUMENTS --yes --claude-config-json '{"defaultNamespace":"${user_config.defaultNamespace}","scaffoldDirectory":"${user_config.scaffoldDirectory}","scriptsDirectory":"${user_config.scriptsDirectory}","localDirectory":"${user_config.localDirectory}","esLintConfigLocation":"${user_config.esLintConfigLocation}"}'
```

Cursor adapter (`commands-cursor/<name>.md`):

```markdown
---
name: script-forge-scaffold
description: Create a new Script Forge workspace
---

Run `npx -y glowing-trefoil scaffold` with the name and flags the user supplied after the command.
```

OpenCode adapter (`commands-opencode/script-forge-<name>.md`):

```markdown
---
description: Create a new Script Forge workspace
---

Run:
npx -y glowing-trefoil scaffold $ARGUMENTS --yes
```

Rules:

- The shared prose carries consent, config notes, summary, and exit-code mapping.
- The CLI is non-interactive. Write commands require `--yes`; the command prose obtains consent first.
- Claude `userConfig` is passed as JSON; Cursor and OpenCode use portable config only.
- Cursor does not document `$ARGUMENTS`; use natural language there.
- Generated files are committed. CI runs `bun run build:commands` and fails on `git diff --exit-code`.
- `allowed-tools` is limited to `Bash(npx:*)`; do not grant file-writing shell tools.

## 9. Work breakdown

### Phase 0 — Baseline and rename (user action required)

- [ ] Create branch `refactor/glowing-trefoil`; tag `pre-collection-refactor`.
- [ ] Record baseline: `bun install`, `bun run lint`, `bun run typecheck`.
- [ ] Rename the GitHub repo to `glowing-trefoil` (user action).
- [ ] Update the local remote: `git remote set-url origin https://github.com/NuclearManatee/glowing-trefoil.git`.
- [ ] Add `LICENSE` (MIT).
- [ ] Add `docs/adr/0001-plugin-collection-layout.md`.

Acceptance: baseline commands pass; remote points at the new URL.

### Phase 1 — Move to the collection layout

- [ ] `git mv skills/anvil plugins/script-forge/skills/anvil`.
- [ ] `git mv assets/script-forge.md plugins/script-forge/assets/script-forge.md`.
- [ ] `git mv skills/anvil/assets/eslint.tooling.js plugins/script-forge/assets/eslint.tooling.js` (the rulebook config; the root `eslint.tooling.js` stays as a repo-only wrapper that imports it).
- [ ] Rewrite the root `eslint.tooling.js` wrapper: remap `files` to repo globs and disable `unicorn/filename-case` for repo code only.
- [ ] `git mv templates plugins/script-forge/templates`.
- [ ] `git mv commands/scaffold.md plugins/script-forge/commands-src/scaffold.md` (same for doctor, lint).
- [ ] Replace `commands/scripts/doctor-check.ts` with `plugins/script-forge/lib/doctor.ts`.
- [ ] Add `plugins/script-forge/cli/index.ts` and `plugins/script-forge/lib/*.ts`.
- [ ] Add root `scripts/buildCommands.ts`, `scripts/buildCli.ts`, and `scripts/validate.ts`.
- [ ] Update `tsconfig.json` includes to `plugins/**/*.ts`, `scripts/**/*.ts`, `tests/**/*.ts`.
- [ ] Add `dist/`, `*.tgz`, and `node_modules/` to `.gitignore`.

Acceptance: `bun install` produces one lockfile; `bun run typecheck` passes; exactly one copy of the rulebook ESLint config exists (the plugin asset), plus the repo-only wrapper.

### Phase 2 — Manifests

- [ ] `plugins/script-forge/.claude-plugin/plugin.json`: metadata, `commands: "./commands/"`, `skills: "./skills/"`, five `userConfig` keys with real defaults.
- [ ] `plugins/script-forge/.cursor-plugin/plugin.json`: metadata, `commands: "./commands-cursor/"`, `skills: "./skills/"`.
- [ ] Root `.claude-plugin/marketplace.json`: `name: glowing-trefoil`, owner, one entry `script-forge` with `source: "./plugins/script-forge"`.
- [ ] Root `.cursor-plugin/marketplace.json`: `name: glowing-trefoil`, owner, `metadata.description`, one entry `script-forge` with `source: "./plugins/script-forge"`.
- [ ] Remove the old root `.claude-plugin/plugin.json`.
- [ ] Set version `1.0.0` in both plugin manifests and root `package.json`.
- [ ] Verify no top-level `bin/` exists.

Acceptance: `claude plugin validate ./plugins/script-forge` and `claude plugin validate .` pass.

### Phase 3 — Make the rulebook and skill portable

- [ ] `skills/anvil/SKILL.md`:
  - Merge `when_to_use` into `description` (Agent Skills has no `when_to_use`).
  - Replace `${user_config.*}` and `${CLAUDE_PLUGIN_ROOT}` with neutral placeholders.
  - Point config details at `references/config.md`.
  - Update asset paths for the collection layout.
- [ ] `references/config.md`: rewrite as the dual-config contract (Claude `userConfig` + portable JSON + precedence + defaults + project-local ESLint config).
- [ ] Replace configured-directory interpolations in `references/lifecycle.md`, `documentation.md`, `domainPatterns.md`, `principles.md`, `assets/script-forge.md`, `assets/readme.template.md`, `assets/prompt.template.md`.
- [ ] Make tool references capability-neutral:
  - `Read`, `Glob`, `Grep` → "your client's file read/search tools".
  - `WebSearch`, `WebFetch` → "web search/fetch tools".
  - `Agent` → "your client's subagent/delegation tool".
  - `AskUserQuestion` → "ask-the-user tool".
  - `/memory`, auto-memory → "the client's persistent memory, when available".
  - Remove the "Environment assumption: Claude Code" paragraph.
- [ ] `assets/runner.ts` comment: `AskUserQuestion/readline` → `the client's ask-the-user tool or readline`.
- [ ] Update the ESLint rule: scaffold copies `assets/eslint.tooling.js` into the project; the project copy resolves from project `node_modules`.
- [ ] Add a grep gate to `scripts/validate.ts` for forbidden portable strings outside generated Claude commands and the documented config section: `${user_config`, `${CLAUDE_PLUGIN_ROOT}`, `AskUserQuestion`, `Claude Code tools`.

Acceptance: `bun run validate` reports no forbidden strings; anvil reads correctly in all four clients.

### Phase 4 — Node-compatible CLI

- [ ] `lib/paths.ts`: locate the package root from `import.meta.url`; support both source (`plugins/script-forge/lib`) and bundled (`dist/cli.js`) layouts. Expose `assets/`, `templates/`, `skills/`.
- [ ] `lib/config.ts`: zod schema, precedence, path safety, `--json` output with value sources.
- [ ] `lib/scaffold.ts`: template copy, directory renames, placeholder rewrite, eslint config copy, optional `bun install`, optional git init/commit, summary.
- [ ] `lib/doctor.ts`: checks listed in §7, `[PASS]/[WARN]/[FAIL]` output, exit `0/2`.
- [ ] `lib/lint.ts`: config and ESLint resolution, file globs, exit mapping.
- [ ] `lib/install.ts`: Cursor/OpenCode install, markers, uninstall.
- [ ] `lib/commands.ts`: shared command constants and exit-code text for the generator.
- [ ] `cli/index.ts`: dispatch `scaffold`, `doctor`, `lint`, `config`, `install`, `uninstall`, `version`, `help`.
- [ ] `scripts/buildCli.ts`: bundle to `dist/cli.js`, Node target, shebang, executable bit where supported.
- [ ] No Bun APIs; no shell strings; array args only.

Acceptance: `bun run typecheck` passes; `node dist/cli.js version` prints `1.0.0`; scaffold works from PowerShell and Git Bash.

### Phase 5 — Generate commands

- [ ] Rewrite `commands-src/*.md` as shared prose plus `{{invocation}}`.
- [ ] Implement `scripts/buildCommands.ts` to emit `commands/`, `commands-cursor/`, and `commands-opencode/`.
- [ ] Claude adapter passes `--claude-config-json`; Cursor and OpenCode do not.
- [ ] Claude `allowed-tools: Bash(npx:*)`.
- [ ] Cursor adapter uses natural-language argument passing; OpenCode uses `$ARGUMENTS`.
- [ ] Commit generated files.
- [ ] Add drift check to CI.

Acceptance: one source edit propagates to all three adapters; `bun run build:commands` leaves no diff after commit.

### Phase 6 — npm package and installers

- [ ] Root `package.json`: name `glowing-trefoil`, version `1.0.0`, `bin`, `files`, `engines`, scripts from §7.
- [ ] `scripts/buildCli.ts` bundles `zod`; `npm pack --dry-run` shows only `dist`, `plugins/script-forge`, `README.md`, `LICENSE`, `package.json`.
- [ ] `install cursor` and `install opencode` work from the packed tarball, not just the dev tree.
- [ ] Uninstall removes only marker-owned paths.
- [ ] `npx -y glowing-trefoil version` works after publish; before publish, test with the packed tarball.
- [ ] Add `docs/install.md` with the four per-harness flows.

Acceptance: packed tarball installs and runs under Node 22; Cursor and OpenCode adapters are copied to the documented paths.

### Phase 7 — Validation, tests, CI

- [ ] `scripts/validate.ts`:
  - Discover `plugins/*/`.
  - Validate Claude/Cursor manifests; names match directories; versions match `package.json`.
  - Validate marketplace entries resolve to existing plugin dirs.
  - Validate every `skills/*/SKILL.md`: `name` matches directory, `description` non-empty ≤1024, no forbidden portable strings.
  - Validate generated commands are current.
  - Validate no POSIX-only shell in command sources (`cp -r`, `mkdir -p`, `mv `, `cd ... &&`).
  - Validate no top-level `bin/` in any plugin.
  - Print one line per check; exit `1` on errors.
- [ ] Tests:
  - `config.test.ts`: precedence, defaults, path safety, Claude override layer.
  - `scaffold.test.ts`: temp dir copy, hidden files, custom directory names, placeholder rewrite, eslint config copy, `--force`, existing `package.json` refusal, no writes on refusal, missing Bun warning.
  - `doctor.test.ts`: missing Bun, missing deps, healthy fixture.
  - `lint.test.ts`: no files → 0; missing deps → 2; missing config → 2; target selection.
  - `commands.test.ts`: three variants contain the right frontmatter and no cross-client leakage.
  - `install.test.ts`: fresh copy, marker, overwrite refusal, uninstall scope.
  - `validate.test.ts`: fixture plugin passes; broken manifest/skill fails.
- [ ] `.github/workflows/ci.yml`:
  - Matrix `ubuntu-latest`, `windows-latest`; Bun `1.3.14`; Node `22`.
  - `bun install --frozen-lockfile`, `bun run lint`, `bun run typecheck`, `bun test`, `bun run validate`, `bun run build:commands` + `git diff --exit-code`, `bun run build`, `npm pack --dry-run`.

Acceptance: CI green on both OSes.

### Phase 8 — Documentation

- [ ] Root `README.md`: collection pitch, catalog, install matrix, config contract, development commands.
- [ ] `docs/install.md`: exact per-harness steps, updates, uninstalls, verification, and Cowork's Bun limitation.
- [ ] `AGENTS.md`: layout rules, manifest obligations, generated commands, version sync, no shell in scripts, Bun pin, “adding a new plugin” checklist.
- [ ] `CLAUDE.md`: short pointer to `AGENTS.md`; keep only Claude-specific notes.
- [ ] `plugins/script-forge/README.md`: commands, config, per-client invocation, troubleshooting.
- [ ] Update the rulebook and references per Phase 3.
- [ ] Keep `docs/adr/0001-plugin-collection-layout.md` in sync with the final decisions.

Acceptance: a new contributor can add a plugin by following `AGENTS.md` without reading this plan.

### Phase 9 — Release and per-harness verification

- [ ] Publish `glowing-trefoil@1.0.0` to npm.
- [ ] Push the renamed repository; confirm the marketplace URL resolves.
- [ ] Install and verify each harness per §10.
- [ ] Tag `v1.0.0`.

Acceptance: all four harness checks pass; the documented install commands work from a clean machine state.

## 10. Verification

Repository:

```sh
bun install
bun run lint
bun run typecheck
bun test
bun run validate
bun run build:commands
git diff --exit-code
bun run build
npm pack --dry-run
```

Packed package:

```sh
npm pack
mkdir -p "$TMP/gt-smoke"
npm install --prefix "$TMP/gt-smoke" ./glowing-trefoil-1.0.0.tgz
"$TMP/gt-smoke/node_modules/.bin/glowing-trefoil" version
```

Fresh workspace:

```sh
glowing-trefoil scaffold smoke-test --target "$TMP/gt-workspace" --yes
cd "$TMP/gt-workspace"
bun install
node node_modules/eslint/bin/eslint.js --no-error-on-unmatched-pattern --config ./eslint.tooling.js "scripts/**/*.ts"
```

Client checks:

- **Claude Code**: `claude plugin validate .`, `claude plugin validate ./plugins/script-forge`; install with the documented command; `/script-forge:scaffold` appears; `doctor` runs through `npx`; a non-default `userConfig` value reaches the CLI.
- **Cowork**: add the marketplace in Customize → Plugins; install `script-forge` (no `bin/` rejection); `/script-forge:scaffold` appears; the command runs in a task; confirm behavior when Bun is absent.
- **Cursor**: `npx -y glowing-trefoil install cursor`; reload; `/script-forge-scaffold` and the `anvil` skill appear; run scaffold.
- **OpenCode**: `npx -y glowing-trefoil install opencode`; restart; `/script-forge-scaffold` is registered; `@anvil` is discoverable.
- **ESLint**: scaffold a project, add a trivial `.ts` file with a violation, run `script-forge lint`; confirm the project-local config resolves its imports from the project's `node_modules`.
- **Uninstall**: remove each harness adapter; confirm no unrelated files are deleted.

## 11. Risks and open questions

1. **npm publish is a release step.** Without it, every command needs a long GitHub spec. Publish `glowing-trefoil`; keep `npx -y github:NuclearManatee/glowing-trefoil ...` for pre-release testing only.
2. **`npx -y` network access.** First run downloads the package; later runs use the npm cache. Cowork allowlists the npm registry. A sandboxed Claude Code session needs network permission.
3. **Cowork package scanning.** A command that runs `npx -y` may be flagged as a package install. Verify with a real Cowork install; if flagged, document the prompt or move to a remote MCP server, which is heavier.
4. **Cowork lacks Bun.** The CLI runs on Node, but the generated workspace is Bun-based. Scaffold creates files and skips install; doctor fails until Bun is available. Document this clearly.
5. **Cursor local plugin imports.** Enterprise admins can disable them. The marketplace path is the fallback. Verify on personal Cursor first.
6. **Cursor `$ARGUMENTS`.** Undocumented. Cursor adapters use natural language; verify a command with arguments.
7. **Claude `userConfig` quoting.** The JSON is passed in single quotes, which works in Claude Code's Bash tool on Windows and POSIX. Values containing single quotes are unsupported; validate and document.
8. **Marketplace cache.** Claude/Cowork marketplace installs are copies; an npm publish does not update them. Keep the plugin version in the marketplace manifests and document the update commands.
9. **Repo rename.** GitHub redirects old URLs, but existing marketplaces and clones must be re-added or re-pointed. Do the rename before the first release under the new name.
10. **Version policy.** `1.0.0` for the restructured plugin. Recommended: independent per-plugin versions, with the marketplace listing the current version.

## 12. Rollback

- Work on `refactor/glowing-trefoil`, not `main`.
- Tag `pre-collection-refactor` before moving files.
- If the refactor is abandoned, `git reset --hard pre-collection-refactor` on the branch; the old `.claude-plugin/plugin.json` and root layout remain intact on `main`.
