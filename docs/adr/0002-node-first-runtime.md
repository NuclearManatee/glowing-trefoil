# ADR 0002 — Node-first runtime for generated workspaces

Status: accepted
Date: 2026-11-14
Owner: NuclearManatee
Supersedes: ADR 0001 section 7 ("Bun builds, Node runs") and the accepted cost
"the generated workspace is Bun-based".
Related: `docs/plans/2026-11-14-node-runtime/decision.md`,
`docs/plans/2026-11-14-node-runtime/harness-matrix.md`

## Context

ADR 0001 chose Bun `1.3.14` as the development, test, and build runtime, and
accepted that generated workspaces could not run in Cowork without Bun. That
was tolerable while Cowork was one of several targets. It is no longer
tolerable now that Cowork is the environment the plugin is expected to work in.

The constraint that forces this ADR is not preference; it is the runtime the
plugin's output must execute on. Cowork runs plugin shell commands in a VM and
does not document a Bun installation. Node is the runtime the distribution path
already assumes: `npx` needs npm, and npm needs Node.

Two facts narrow the design:

1. Node 22.18.0 enabled TypeScript type stripping by default, with no flag.
   Node 22 still labels the feature Stability 1.2 (Release candidate); Node 24
   labels it Stable. The feature is operational without flags, but it is not
   formally stable on the line Cowork is believed to run.
2. Node refuses to run TypeScript files inside `node_modules`. A package
   installed by `npx` therefore cannot ship `.ts` entry points. The CLI must be
   compiled JavaScript regardless of the workspace story.

## Decision

### 1. Node is the only required runtime

Generated workspaces target **Node 22.18.0+** and npm. Templates declare
`engines.node`, ship `@types/node`, run tests with `node --test`, and run
scripts with `node`. Bun is not a prerequisite anywhere in the product.

The repository uses npm, `package-lock.json`, `node --test`, and `tsc`. Bun may
remain available on a contributor's machine as an optional convenience, but no
documented command depends on it.

### 2. The CLI ships compiled JavaScript

`dist/` is produced by `tsc` and contains only the JavaScript the CLI imports.
`zod` is a runtime dependency. The package `bin` points at the emitted entry
point. No `.ts` file is executed from the npm package, because Node forbids it
under `node_modules`.

### 3. Workspace code is erasable TypeScript, run directly

Generated workspaces do not add a build step. They rely on Node's type
stripping and stay inside its limits: no enums, no namespaces with runtime
code, no parameter properties, no import aliases, no `.tsx`, no tsconfig paths,
and explicit `.ts` extensions in relative imports. `tsc --noEmit` enforces
these limits via `erasableSyntaxOnly` and `verbatimModuleSyntax`.

This is accepted as a release-candidate dependency on Node 22. If strict
stability is later required, the fallback is to compile the workspace before
running it, not to reintroduce Bun.

### 4. Bun-only APIs are replaced, not emulated

- Checkpoint state uses a JSON file with atomic temp-file rename instead of
  `bun:sqlite`.
- HTML parsing uses `cheerio` instead of `HTMLRewriter`.
- HTTP uses `node:http` or `hono` with `@hono/node-server` instead of
  `Bun.serve`.
- `.env` loading uses `node --env-file-if-exists=.env` instead of Bun's
  automatic loader.
- `import.meta.dir` becomes `import.meta.dirname`; `import.meta.main` is
  available natively from Node 22.18.

`node:sqlite` is not used: it is Stability 1.1 on Node 22 and emits an
experimental warning there. `@js-temporal/polyfill` stays because no Node LTS
exposes a global `Temporal`.

## Consequences

Positive:

- A workspace scaffolded in Cowork can install, test, and run there.
- One documented runtime for CLI, templates, CI, and contributors.
- One tested runtime floor: Node 22.18.0. The compiled CLI would run on earlier
  22.x patches, but they are deliberately outside the support matrix.
- Fewer moving parts: no Bun build, no Bun test runner, no `bun:sqlite`.

Negative / accepted costs:

- Node 22's type stripping is a release candidate; Node 24+ is needed for the
  Stable designation.
- The JSON checkpoint store gives up SQL queries and multi-writer
  transactions. The runner does not use either.
- npm install and test startup are slower than Bun's.
- Removing Bun from the repo is a broad, mechanical change across scripts,
  tests, templates, CI, and the rulebook.
- Cowork's Node version remains undocumented until probed; this ADR assumes
  >= 22.18.0.

## Rejected alternatives

| Alternative | Why rejected |
| --- | --- |
| Keep Bun and document the Cowork limitation | Defeats the plugin's purpose in the environment that motivated the work. |
| Node runtime, Bun kept as the dev/test toolchain | Two toolchains, two lockfiles, and a rulebook that still teaches Bun. |
| Ship TypeScript sources through `npx` | Node refuses to execute `.ts` under `node_modules`. |
| Use `node:sqlite` for checkpoints | Experimental warning on Node 22; adds a database for keyed lookups. |
| Require Node 24 for Stable TypeScript | Cowork is believed to run Node 22.22; the floor would exclude it. |
| Compile every generated workspace before running | Heavy developer loop; only justified if strict stability is required. |
