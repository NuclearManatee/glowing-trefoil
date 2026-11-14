# Changelog

All notable changes to this collection are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Node TypeScript guardrails in the rulebook and `anvil` skill: erasable-syntax
  rules, mandatory `.ts` import extensions, `import type`, and banned Bun APIs.
- ESLint rules that reject `enum`, parameter properties, import aliases,
  decorators, `Bun.*`, `bun:*`, `HTMLRewriter`, `import.meta.dir`, and
  `node:sqlite`.
- `tests/smoke.test.ts` in the workspace template so `npm test` is green before
  the first script exists.
- `tests/runner.test.ts`, covering resume, rollback, orphan confirmation,
  corrupt state, and context serialization.

### Changed

- Runtime moved from Bun to **Node 22.18+** and npm. The CLI is compiled to
  `dist/cli/index.js` with `tsc`; generated workspaces run `.ts` directly
  through Node's type stripping.
- Templates target NodeNext with `node --test`, `@types/node`, and
  `engines.node >=22.18.0`.
- The anvil checkpoint engine uses an atomic JSON state file instead of
  `bun:sqlite`; `node:sqlite` is avoided because it is experimental on Node 22.
- Rulebook, skill references, commands, README, install guide, and repository
  agent guide rewritten for Node.

### Removed

- Bun runtime pin, `bun.lock`, `bun:test`, `bun:sqlite`, and `@types/bun`.

## [1.0.0] - 2026-11-14

### Added

- `glowing-trefoil` collection with the `script-forge` plugin as its first
  entry, installable in Claude Code, Cowork, Cursor, and OpenCode.
- Node 22+ CLI (`npx -y glowing-trefoil`) covering `scaffold`, `doctor`, `lint`,
  `config`, `install`, `uninstall`, `version`, and `help`.
- Generated command adapters for Claude Code/Cowork, Cursor, and OpenCode from
  one `commands-src/` source.
- Portable config with a fixed precedence: CLI, project `.script-forge.json`,
  Claude `userConfig`, global config, defaults.
- Project-local ESLint config copied by `scaffold`, so its imports resolve from
  the project's own `node_modules`.
- Marker-owned Cursor and OpenCode installers with scoped uninstall.
- Validator, 39 tests, and CI on Windows and Linux, including a generated-file
  drift check.

### Changed

- Plugin moved under `plugins/script-forge/`; the plugin artifact has no
  `bin/`, `package.json`, or `node_modules/`.
- Rulebook, skill, and references made client-neutral.
- The template `.gitignore` ships as `templates/gitignore` (npm strips dotfiles)
  and is renamed by `scaffold`.

### Fixed

- Tracked the template `local/` directories after anchoring `/local/` in the
  root ignore file, so scaffold works from a clean checkout.

[Unreleased]: https://github.com/NuclearManatee/glowing-trefoil/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/NuclearManatee/glowing-trefoil/releases/tag/v1.0.0
