# ADR 0001 — Plugin collection layout and per-harness installation

Status: accepted
Date: 2026-11-04
Owner: NuclearManatee
Related: `docs/plans/2026-11-03-glowing-trefoil-refactor.md`, `docs/plans/2026-11-04-install-dx-proposal.md`

## Context

`script-forge` started as a single Claude Code plugin installed from a Git marketplace. It now needs to run in Claude Code, Claude Cowork, Cursor, and OpenCode without maintaining four copies of the workflow.

The constraints that drive the design:

- Cowork installs the same `.claude-plugin` artifact as Claude Code but rejects any plugin with a top-level `bin/` directory.
- Cowork never prompts for `userConfig` and may not have Bun in its sandbox.
- Cursor has no non-interactive plugin install command; its documented local plugin folder is `~/.cursor/plugins/local/`.
- OpenCode has no command marketplace; commands are markdown files and skills are folders in its config directories.
- Claude Code has a plugin marketplace CLI and supports `userConfig`.
- Workflow logic must be shared, testable, and identical across clients.
- The repository must build and test on Windows and Linux.

## Decision

### 1. One collection repository, one plugin folder

The repository is the `glowing-trefoil` marketplace. Plugins live under `plugins/<id>/`; `script-forge` stays the plugin id. The marketplace manifest points at `plugins/script-forge`.

### 2. One npm package holds the plugin and the CLI

Publish one npm package, `glowing-trefoil`, containing:

- `plugins/script-forge/` — skills, commands, assets, templates;
- `dist/cli.js` — a Node 22+ CLI bundled from TypeScript.

Every command calls the CLI through `npx`:

```sh
npx -y glowing-trefoil <command> ...
```

The plugin artifact contains no executable and no `bin/`. The CLI carries its own dependencies, so the plugin needs no `package.json` and no `node_modules`.

### 3. Per-harness native install surfaces

| Harness | Surface |
| --- | --- |
| Claude Code | `claude plugin install script-forge --marketplace NuclearManatee/glowing-trefoil` |
| Cowork | Customize → Plugins → Add marketplace → repository → Install |
| Cursor | `npx -y glowing-trefoil install cursor` copies to `~/.cursor/plugins/local/script-forge` |
| OpenCode | `npx -y glowing-trefoil install opencode` copies commands and the `anvil` skill |

There is deliberately no `install --all`. Each harness has one documented path that matches how that harness expects software to arrive.

### 4. One command source, three generated adapters

`plugins/script-forge/commands-src/` holds the shared prose: consent, run step, summary, exit-code mapping. `scripts/buildCommands.ts` emits:

- `commands/` for Claude Code and Cowork;
- `commands-cursor/` for Cursor;
- `commands-opencode/` for OpenCode.

Only frontmatter and the invocation line differ. Generated files are committed so marketplace installs need no build step. CI regenerates them and fails on drift.

### 5. Dual config with a fixed precedence

Highest to lowest:

1. CLI flags.
2. Project `.script-forge.json`.
3. Claude `userConfig`, passed as `--claude-config-json`.
4. Global `~/.config/script-forge/config.json`.
5. Defaults.

Empty values fall through to the next layer. Claude `userConfig` defaults are real defaults so Cowork and Cursor work without configuration.

### 6. Project-local ESLint config

`scaffold` copies `plugins/script-forge/assets/eslint.tooling.js` into the generated project. The copied config's imports resolve from the project's `node_modules`, not from an npm cache or a plugin install. A custom `esLintConfigLocation` skips the copy and points `package.json` at the user's config.

### 7. Bun builds, Node runs

Bun `1.3.14` is the development, test, and build runtime. The shipped CLI targets Node 22+ because Cowork and normal `npx` environments guarantee Node, not Bun. The CLI uses only Node APIs and array-based subprocess calls.

## Consequences

Positive:

- One workflow implementation, one test suite, one release.
- Every harness install is idiomatic for that harness.
- Cowork installs the plugin because it has no `bin/`.
- Cursor and OpenCode need no global binary, no `bun link`, and no symlinks.
- The plugin artifact stays small; dependency weight lives in the npm package.
- Generated commands make the shared source auditable and drift-checkable.

Negative / accepted costs:

- An npm release is required for the short install/run commands. Before a release, the GitHub spec works but is long.
- `npx` needs network access on first run.
- The generated workspace is Bun-based; Cowork can scaffold it but cannot install or run it without Bun. Doctor reports this honestly.
- Cursor Enterprise can disable local plugin imports; the marketplace path is the fallback.
- Claude `userConfig` values are interpolated into a shell command, so values containing single quotes are unsupported.

## Rejected alternatives

| Alternative | Why rejected |
| --- | --- |
| Four copies of the workflow logic | Guaranteed drift; four test surfaces. |
| Skills only, no commands | Loses explicit, user-invoked entry points and exit-code contracts. |
| Global `bun link` / global CLI | Hidden machine state; fails in Cowork; updates break the link. |
| Plugin `bin/` directory | Cowork and chat reject the plugin. |
| Plugin `package.json` + `node_modules` | Bloats the marketplace artifact and breaks Cowork installs. |
| Root Agent Plugins `plugin.json` | Does not cover commands; a second manifest alongside `.cursor-plugin` invites ambiguity. |
| Universal `install --all` | Cowork and Cursor cannot be installed non-interactively; it would promise more than it can do. |
| Committing `dist/` | Build output churn; `prepack` builds it for npm. |
