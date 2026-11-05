# Install DX proposal — per-harness native surfaces, one shared codebase

Status: approved 2026-11-04
Date: 2026-11-04
Supersedes: the install and packaging sections of `2026-11-03-glowing-trefoil-refactor.md`
Companion: `docs/adr/0001-plugin-collection-layout.md`

## 1. Goal

Give each harness one install path that feels native to that harness, while keeping one plugin source, one CLI, and one set of command sources.

Constraints:

- No universal `install --all` command. Each harness gets its own step.
- No global `bun link`. A command must work after the harness install alone.
- No top-level `plugins/script-forge/bin/`. Cowork and chat refuse to install such a plugin.
- Claude Code, Cowork, Cursor, and OpenCode must all run the same workflow logic.
- The plugin artifact stays small; the CLI and its dependencies live in one npm package.

## 2. Core decision

Publish one npm package, `glowing-trefoil`, containing:

- the plugin folder `plugins/script-forge/` (skills, commands, assets, templates);
- a Node-compatible CLI built from Bun/TypeScript into `dist/cli.js`.

Every generated command calls the CLI through `npx`:

```sh
npx -y glowing-trefoil <scaffold|doctor|lint> ...
```

Why `npx`:

- Node 22+ is present in Cowork and normal for Claude Code, Cursor, and OpenCode users.
- Bun is not guaranteed in Cowork; `npx` is.
- It removes the global `bun link` seam and the plugin `node_modules` problem.
- The CLI can carry its own dependencies; the plugin does not need a `package.json`.

The plugin itself contains no executable and no `bin/`, so Cowork installs it.

## 3. Per-harness install

| Harness | Install step | Native surface | Updates |
| --- | --- | --- | --- |
| Claude Code | `claude plugin install script-forge --marketplace NuclearManatee/glowing-trefoil` | Claude plugin marketplace CLI | `claude plugin update script-forge@glowing-trefoil` |
| Cowork | Customize → Plugins → Add → Add marketplace → `NuclearManatee/glowing-trefoil` → Install `script-forge` | Cowork account plugin marketplace | Update in Customize |
| Cursor | `npx -y glowing-trefoil install cursor`, then reload the window | Cursor local plugin folder `~/.cursor/plugins/local` | Re-run the install command |
| OpenCode | `npx -y glowing-trefoil install opencode`, then restart | OpenCode command and skill folders | Re-run the install command |

### 3.1 Claude Code

One command:

```sh
claude plugin install script-forge --marketplace NuclearManatee/glowing-trefoil
```

- Requires Claude Code v2.1.292 or later. The local install is v2.1.302.
- Installs at user scope by default.
- The shell install does not prompt for `userConfig`; the manifest defaults apply.
- To change config later: `/plugin configure script-forge@glowing-trefoil`.
- Verify: `/script-forge:scaffold` appears.

Why this is native: it uses Claude Code's own plugin installer, adds the marketplace on demand, and needs no clone, no Bun, and no global binary.

### 3.2 Cowork

No command exists. The native flow is the account plugin marketplace:

1. Open Cowork.
2. Open Customize → Plugins.
3. Choose Add → Add marketplace.
4. Enter `NuclearManatee/glowing-trefoil`.
5. Install `script-forge`.

The same `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json` used by Claude Code serve Cowork. The plugin must not have a top-level `bin/`; it does not.

Verify: `/script-forge:scaffold` appears; run it in a Cowork task. The command uses `npx`, which works in the Cowork sandbox because Node and npm are preinstalled and the npm registry is allowlisted.

Config in Cowork: `userConfig` is not prompted; defaults apply. Project overrides go in `.script-forge.json` in the connected folder.

### 3.3 Cursor

Recommended for a personal collection: install into Cursor's local plugin folder.

```sh
npx -y glowing-trefoil install cursor
```

Then reload Cursor: Command Palette → Developer: Reload Window.

What the command does:

- Copies `plugins/script-forge/` to `~/.cursor/plugins/local/script-forge/`.
- Replaces only that folder on update; other local plugins are untouched.
- Requires local plugin imports to be allowed (default on personal Cursor; Enterprise can disable).

Why this is native: `~/.cursor/plugins/local` is Cursor's documented local plugin surface. It avoids the UI-only marketplace install and works cross-platform without symlinks.

Alternative for sharing: `cursor-agent plugin marketplace add https://github.com/NuclearManatee/glowing-trefoil`, then install `script-forge` from Customize or `/plugin`. There is still no non-interactive plugin install command in Cursor.

Verify: `/script-forge-scaffold` appears; the `anvil` skill is listed.

### 3.4 OpenCode

```sh
npx -y glowing-trefoil install opencode
```

Then restart OpenCode.

What the command does:

- Copies the generated OpenCode commands to `~/.config/opencode/commands/script-forge-scaffold.md`, `script-forge-doctor.md`, and `script-forge-lint.md`.
- Copies `skills/anvil/` to `~/.agents/skills/anvil/`.
- Does not edit `opencode.json(c)`.
- Replaces only the files it owns on update.

Why this is native: OpenCode has no plugin marketplace for commands; its native surface is markdown commands plus Agent Skills in the config directories.

Verify: `/script-forge-scaffold` is registered and `@anvil` is discoverable.

## 4. Shared codebase

```text
glowing-trefoil/
├── package.json                       # npm package: glowing-trefoil
├── dist/cli.js                        # built Node 22+ CLI
├── plugins/script-forge/
│   ├── .claude-plugin/plugin.json     # Claude Code + Cowork
│   ├── .cursor-plugin/plugin.json     # Cursor
│   ├── skills/anvil/                  # shared skill
│   ├── assets/script-forge.md         # shared rulebook
│   ├── assets/eslint.tooling.js       # copied into scaffolded projects
│   ├── templates/                     # shared workspace skeleton
│   ├── commands-src/                  # shared command bodies
│   ├── commands/                      # generated: Claude + Cowork
│   ├── commands-cursor/               # generated: Cursor
│   ├── commands-opencode/             # generated: OpenCode
│   ├── cli/                           # CLI source, bundled to dist/cli.js
│   └── lib/                           # config, scaffold, doctor, lint
├── scripts/validate.ts
├── tests/
└── docs/install.md                    # per-harness install guide
```

Deliberate omissions:

- No root `plugin.json` Agent Plugins manifest. Cursor uses `.cursor-plugin/plugin.json`; a second manifest invites format ambiguity. Agent Plugins only cover skills and MCP, not commands.
- No `plugins/script-forge/package.json`.
- No `plugins/script-forge/bin/`.
- No plugin `node_modules`.

## 5. Command generation

One body per command in `commands-src/`, three generated adapters.

### Claude + Cowork

```markdown
---
description: Create a new Script Forge workspace
argument-hint: "[name] [--flags]"
allowed-tools: Bash(npx:*)
disable-model-invocation: true
---

Run `npx -y glowing-trefoil scaffold $ARGUMENTS --claude-config-json '{"defaultNamespace":"${user_config.defaultNamespace}",...}'`.
```

### Cursor

```markdown
---
name: script-forge-scaffold
description: Create a new Script Forge workspace
---

Run `npx -y glowing-trefoil scaffold` with the name or flags the user supplied after the command.
```

### OpenCode

```markdown
---
description: Create a new Script Forge workspace
---

Run `npx -y glowing-trefoil scaffold $ARGUMENTS`.
```

Rules:

- The workflow prose (consent, summary, exit-code mapping) is shared from `commands-src/`.
- Only frontmatter and the invocation line differ.
- Generated files are committed. CI regenerates and fails on drift.
- Cursor does not document `$ARGUMENTS`; use natural language instead of assuming it.

## 6. CLI and npm package

`package.json`:

```json
{
  "name": "glowing-trefoil",
  "version": "1.0.0",
  "type": "module",
  "bin": { "glowing-trefoil": "./dist/cli.js" },
  "files": ["dist", "plugins/script-forge"],
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "bun build plugins/script-forge/cli/index.ts --target=node --outfile=dist/cli.js",
    "prepack": "bun run build"
  }
}
```

- Build with Bun; run with Node. This is the one intentional runtime split.
- The CLI resolves templates and assets relative to `dist/cli.js`; the npm package includes them.
- Bundle dependencies into `dist/cli.js` so `npx` has no install step beyond the package itself.
- Add a `#!/usr/bin/env node` shebang in the build output.
- Subcommands: `scaffold`, `doctor`, `lint`, `config`, `install cursor`, `install opencode`, `uninstall cursor|opencode`, `version`.

Before the first npm release, the same commands work with:

```sh
npx -y github:NuclearManatee/glowing-trefoil ...
```

Do not make the GitHub spec the documented path; it makes every command long and slow.

## 7. Config

Priority, highest to lowest:

1. CLI flags.
2. Project `.script-forge.json`.
3. Claude `userConfig` passed as `--claude-config-json`.
4. Global `~/.config/script-forge/config.json`.
5. Defaults.

Rules:

- `userConfig` defaults are real defaults, so Cowork and Cursor work without configuration.
- Cursor and OpenCode commands use only portable config; they do not pass Claude config.
- Scaffold copies `eslint.tooling.js` into the new project and records its path. Lint resolves the config's imports from the project's `node_modules`, not the npm cache.
- Scaffold adds the five ESLint deps plus `zod` to the project.

## 8. Updates and uninstalls

| Harness | Update | Uninstall |
| --- | --- | --- |
| Claude Code | `claude plugin update script-forge@glowing-trefoil` | `claude plugin uninstall script-forge@glowing-trefoil` |
| Cowork | Update from Customize → Plugins | Uninstall from Customize → Plugins |
| Cursor | `npx -y glowing-trefoil install cursor` | `npx -y glowing-trefoil uninstall cursor` |
| OpenCode | `npx -y glowing-trefoil install opencode` | `npx -y glowing-trefoil uninstall opencode` |

The CLI owns only `~/.cursor/plugins/local/script-forge/`, the three OpenCode command files, and `~/.agents/skills/anvil/`. Uninstall removes only those.

## 9. Migration from the 2026-11-03 plan

- Drop the global `bun link` seam and the stable data directory.
- Drop `plugins/script-forge/bin/`; the CLI lives in the npm package.
- Drop the plugin `package.json` and its ESLint dependencies.
- Drop the root Agent Plugins `plugin.json`.
- Replace `bunx glowing-trefoil install --tool all` with the four per-harness steps above.
- Keep: one `commands-src`, generated adapters, Bun tests, validator, Windows + Linux CI.

## 10. Verification

Build and package:

```sh
bun install
bun run lint
bun run typecheck
bun test
bun run validate
bun run build:commands
bun run build
npm pack --dry-run
```

Per harness:

- Claude Code: install command succeeds; `/script-forge:scaffold` appears; `doctor` runs through `npx`.
- Cowork: marketplace add + install succeeds despite no `bin/`; `/script-forge:scaffold` runs in a task.
- Cursor: `install cursor` copies the plugin; reload shows `/script-forge-scaffold` and `anvil`.
- OpenCode: `install opencode` copies files; `/script-forge-scaffold` and `@anvil` are available.
- Fresh project: scaffold, add a lint violation, run `script-forge lint`, confirm the project-local ESLint config resolves.

## 11. Tradeoffs and open questions

1. **npm publish is a release step.** Without it, every command uses a long GitHub spec. Recommended: publish `glowing-trefoil`; keep the GitHub spec for pre-release testing.
2. **Node 22+ is required at command time.** Bun is required only for development. This is the price of Cowork compatibility.
3. **`npx` network access.** First run downloads the package; later runs use the npm cache. Cowork allowlists the npm registry. A sandboxed Claude Code session needs network permission.
4. **Cowork plugin scanning.** A command that runs `npx -y` may be flagged as a package install. Verify with a real Cowork install; if flagged, document the prompt or switch to a remote MCP server, which is heavier.
5. **Cursor local plugin imports.** Enterprise admins can disable them. For personal Cursor, the default is on. The marketplace path remains the fallback.
6. **CLI/node version.** Node 22 is the floor for `fs.cp`, `structuredClone`, and ESM. Cowork's Node 22.22 is compatible.
