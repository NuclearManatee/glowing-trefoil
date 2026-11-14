# Changelog

All notable changes to this collection are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
