# Node-first runtime: decision

Status: accepted
Date: 2026-11-14
Owner: NuclearManatee
Companions: `harness-matrix.md`, `cowork-vm.md`, `node-ts.md`,
`docs/adr/0001-plugin-collection-layout.md`,
`docs/adr/0002-node-first-runtime.md`

## Verdict

Refactor to **Node-first**, but not to "Node-native TypeScript everywhere".

- The published CLI must keep shipping **compiled JavaScript**. Node refuses to
  run `.ts` files under `node_modules`, so `npx -y glowing-trefoil` can never
  execute TypeScript sources.
- Generated workspaces can run **erasable TypeScript directly** on Node
  **22.18+**, with no flag and no warning.
- "No experimental modes" holds operationally, not formally. Node 22 still
  labels type stripping **Stability 1.2 - Release candidate**, and the 22.18.0
  release note calls the feature experimental. Only Node 24+ labels it Stable.
- Drop Bun from every shipped surface. It may stay as an optional local
  convenience, but nothing in the product should require it.

## Premise audit

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Cowork runs plugin shell commands on Node | **Unverified** | Cowork docs say commands run in a VM on the machine; the Node version is not documented. |
| Node 22 runs TypeScript without a flag | **True from 22.18.0** | 22.18.0 enabled type stripping by default; 22.22.0 runs erasable `.ts` with no flag and no warning. |
| No experimental mode is involved | **False in the strict sense** | v22 docs: Stability 1.2 (Release candidate). 22.18.0 release note: "This feature is experimental and is subject to change." v24 docs: Stability 2 (Stable). |
| Native TypeScript can back the `npx` CLI | **False** | "Node.js refuses to handle TypeScript files inside folders under a `node_modules` path." |
| Node 22 is enough for the rest of the Bun stack | **Mostly false** | `node:sqlite` is Stability 1.1 on v22 and 1.2 on v24; `Temporal` is undefined on 22.22 and 24.21; no auto-loaded `.env`; no `HTMLRewriter`; no `Bun.serve`. |

The honest summary: **the direction is right, the stated mechanism is only
half right**. Cowork compatibility argues for Node. It does not argue for
running TypeScript in production.

The repository's own `README.md` already states that "Cowork has Node and npm
but not guaranteed Bun". That is an internal assumption, not Anthropic
documentation, but it matches the distribution logic: `npx` needs npm, npm
needs Node.

## Decisive constraints

### 1. The published CLI is JavaScript, full stop

`bun build` currently bundles `cli/index.ts` plus `lib/*.ts` and `zod` into
`dist/cli.js`. That artifact is already correct for Node. The mistake would be
to replace it with raw `.ts` files. Node's own docs draw the line:

> To discourage package authors from publishing packages written in TypeScript,
> Node.js refuses to handle TypeScript files inside folders under a
> `node_modules` path.

`npx` installs the package under `node_modules`. A TypeScript CLI therefore
cannot start, regardless of which Node version Cowork provides.

### 2. Node 22's TypeScript is a release candidate

Node 22.18.0 made type stripping default, but the docs kept it at Stability
1.2 and the release note still calls it experimental. That is fine if the
requirement is "no flags, no warnings". It fails if the requirement is "no
experimental-status features".

There is no version that satisfies both constraints at once:

- Node 22.18+ is what Cowork is believed to run, but its TS support is RC.
- Node 24+ has Stable TS support, but Cowork may not run it.
- Shipping compiled JS works on both and removes the question.

**Recommendation:** treat "no experimental modes" as operational. Keep the
shipped code free of flags, warnings, enums, namespaces with runtime code,
parameter properties, import aliases, tsconfig paths, and `.tsx`. State the RC
status in the ADR so nobody is surprised later.

### 3. Cowork's Node version is still an assumption

The only evidence is an internal note from a previous plan claiming Cowork's
VM runs Node 22.22. Anthropic does not document it. Everything below assumes
that note is correct. Phase 0 is a probe, not a formality; if Cowork has no
Node at all, the distribution model changes and this plan stops.

### 4. Bun-only APIs need replacements, not ports

| Bun feature | Current use | Node replacement |
| --- | --- | --- |
| `bun:sqlite` | `runner.ts` checkpoint store | JSON file + atomic temp-file rename, or `node:sqlite` only on Node 24+ |
| `Bun.build` | `scripts/buildCli.ts` | `tsc` emit (keep `zod` as a runtime dependency) |
| `bun:test` | all eight test files | `node --test` (verified to discover `.test.ts` on 22.22) |
| `Bun.file` / `HTMLRewriter` | rulebook HTML guidance | `cheerio`; `node:fs/promises` for file reads |
| `Bun.serve` | rulebook webhook guidance | `node:http`, or `hono` + `@hono/node-server` |
| Bun auto-`.env` | rulebook config guidance | `node --env-file-if-exists=.env` (22.9+) |
| `import.meta.dir` | build/validate/tests | `import.meta.dirname` (20.11+) |
| `import.meta.main` | `scripts/validate.ts` | `import.meta.main` exists in Node 22.18+ |
| `Temporal` global | rulebook date guidance | keep `@js-temporal/polyfill`; no Node LTS exposes it yet |

## What actually breaks today

The plugin installs and its CLI runs on Node today. The failure is in the
**output**, not the installer:

| Surface | Requires Bun? | Consequence in Cowork |
| --- | --- | --- |
| Plugin commands + `npx glowing-trefoil` | No | Works if the VM has Node and registry access. |
| `scaffold` | Yes, for the generated project | Creates a Bun-based workspace; skips install and tells the user to install Bun. |
| `doctor` | Yes, as a prerequisite check | Reports the workspace as unhealthy in a Node-only VM. |
| Anvil runner | Yes, at runtime | Any script with checkpoint/resume fails to import `bun:sqlite`. |
| Rulebook + references | Yes, as binding instructions | Tells the agent to use Bun, `HTMLRewriter`, and Bun auto-`.env`. |
| Repo CI | Yes | Contributors and CI need Bun even though the product does not. |

This is exactly the accepted cost recorded in ADR 0001: "the generated
workspace is Bun-based; Cowork can scaffold it but cannot install or run it
without Bun." The refactor removes that cost.

## Options

| Option | Work | Risk | Verdict |
| --- | --- | --- | --- |
| **A. Keep Bun** | None | Generated work cannot run in Cowork; contradicts the plugin's own install story | Reject |
| **B. Node runtime, Bun dev-only** | Low | Two toolchains forever; rulebook and templates still say Bun; runner still broken | Reject as an end state |
| **C. Node-first, full migration** | 3-4 focused days | Mechanical churn; runner rewrite; rulebook edits | **Recommend** |
| **D. Node CLI only, document the limitation** | None | Same as A with better prose | Reject |

Option B is tempting because Bun is faster, but it keeps the exact ambiguity
that caused this investigation. Contributors would still need Bun to run the
verification suite, and the rulebook would still be written for a runtime the
product does not target.

## Target design

### Runtime floor

One floor everywhere: **Node 22.18.0**.

- It is the first release where `node file.ts` works with no flag.
- It has `import.meta.main` and `--env-file-if-exists`.
- It is an LTS patch of the line Cowork is believed to run.
- It avoids a two-floor support matrix.

The compiled CLI would run on 22.0, but advertising 22.18 keeps one tested
support matrix instead of two. CI pins the floor exactly (`22.18.x`) plus the
current LTS (`26.x`) to catch drift in both directions.

### Repo tooling

- Package manager: npm, with a committed `package-lock.json`. Remove
  `bun.lock`, `packageManager: bun@...`, and `engines.bun`.
- Test runner: `node --test` with `--test-reporter=spec`. Test files stay
  `tests/*.test.ts`; default discovery finds them on 22.22 (re-verify on 22.18
  in CI).
- Typecheck: `tsc --noEmit` with `module`/`moduleResolution: nodenext`,
  `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`,
  `rewriteRelativeImportExtensions`, and `types: ["node"]`.
- Build: `tsc -p tsconfig.build.json` emitting `dist/`. No bundler.
- Scripts: `node scripts/*.ts`; replace `import.meta.dir` with
  `import.meta.dirname`.

### CLI packaging

`tsc` emits `dist/cli/index.js` and `dist/lib/*.js`. `zod` moves from
`devDependencies` to `dependencies` and stays external, so the npm package
installs it normally. `bin` becomes `./dist/cli/index.js`.

Add `#!/usr/bin/env node` to `cli/index.ts`; `tsc` preserves the shebang, and
npm sets the executable bit from `bin`. The current build script adds it after
bundling, so this step is easy to miss.

Verified with TypeScript 6.0.3 on a scratch project: `tsc` emits the tree,
rewrites relative `.ts` imports to `.js`, preserves the shebang, and the result
runs on Node. Bare specifiers such as `zod` stay untouched.

This is a deliberate change from today's single-file bundle. It removes the
last build-time dependency and makes the shipped tree auditable. The cost is a
slightly larger package and a different internal path; `npx` users see no
difference.

If a single file is preferred, `esbuild` reproduces today's contract with one
dev dependency. Do not use it by default; `tsc` is enough.

### Templates

```json
{
  "type": "module",
  "engines": { "node": ">=22.18.0" },
  "scripts": {
    "lint": "eslint ...",
    "test": "node --test --test-reporter=spec",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^6.0.3",
    "@types/node": "^24.0.0"
  }
}
```

`tsconfig.json` becomes NodeNext with `types: ["node"]` and no `@types/bun`.
Any asset copied into the workspace (`runner.ts`, `stepSchema.ts`) must use
explicit `.ts` import extensions so it typechecks under the same config.

### Checkpoint store

Replace `bun:sqlite` with a dependency-free JSON store:

- One file per run, e.g. `local/state/<script>/<runId>.json`.
- Whole-file read at startup; whole-file write after each step.
- Atomic write: write `*.tmp`, `fsync`, then `rename` over the target.
- Shape: `{ version, runId, steps: Record<string, { status, ranAt, action, rollback }>, context: Record<string, unknown> }`.
- Orphan reconciliation and reverse-replay rollback keep their current
  semantics; only persistence changes.

Why not `node:sqlite`: it works on 22.22 but emits
`ExperimentalWarning: SQLite is an experimental feature and might change at any
time`, and it is Stability 1.1 on v22. It violates the same "no experimental"
bar we are trying to clear.

Why JSON is safe here: the runner is single-process and writes one run's state
at a time. The SQL store's real advantages (transactions, concurrent writers)
are not used. Atomic rename gives crash safety without a database.

### Rulebook and references

The rulebook is binding, so it must change in the same commit as the code.

- "Run with Bun + TypeScript" becomes "Run with Node 22.18+ + TypeScript".
- `engines.bun` / `{{bunPin}}` become `engines.node` / `{{nodePin}}`.
- `bun run <script>` becomes `npm run <script>`.
- `bun:sqlite` for checkpoints becomes the JSON store. For output data, prefer
  JSONL/CSV/Parquet in a build directory; `node:sqlite` is allowed only with
  the Node 22 experimental caveat.
- `HTMLRewriter` becomes `cheerio` (or `htmlparser2` for streaming).
- `hono` on Bun becomes `hono` + `@hono/node-server`, or `node:http`.
- Bun auto-`.env` becomes `node --env-file-if-exists=.env`.
- `Temporal` guidance keeps the polyfill; replace "until Bun ships it" with
  "until Node ships it".
- "Never eval / `bun -e` / Python" becomes "Never eval / `node -e` / Python".
- Remove the `Bun.file('.env')` selector from `assets/eslint.tooling.js`; the
  remaining `.env` file-read bans still apply.

### CI

Replace `setup-bun` with `setup-node`, cache npm, run `npm ci`, `npm test`,
`npm run validate`, `npm run build:commands`, `npm run build`, and the Node
smoke test. Matrix: `22.18.x` and `26.x`, both on Ubuntu and Windows.

## Migration plan

### Phase 0 - Probe Cowork (blocker, 15 minutes)

Run in a real Cowork task and record the output:

1. `node --version` and `npm --version`.
2. `npx -y glowing-trefoil version`.
3. A file containing `const x: string = "ok"; console.log(x);` run with
   `node file.ts`.
4. `node --test` over a directory with one `.test.ts` file.

Do not start Phase 1 until step 1 returns a version >= 22.18.0. If it does not,
stop and revisit distribution.

### Phase 1 - Repo tooling

- Replace `bun.lock` with `package-lock.json`; update `package.json` scripts,
  `engines`, and `packageManager`.
- Rewrite `scripts/buildCli.ts` to use `tsc`.
- Replace `bun:test` imports with `node:test` and `node:assert/strict` in all
  eight test files.
- Replace `import.meta.dir` with `import.meta.dirname`.
- Update `tsconfig.json` to NodeNext.

Exit: `npm test`, `npm run typecheck`, `npm run build` pass on 22.18 and 26.

### Phase 2 - CLI and libraries

- `lib/runtime.ts`: pin/check Node instead of Bun.
- `lib/doctor.ts`: check `node --version`, `engines.node`, `@types/node`;
  remove Bun checks and messages.
- `lib/scaffold.ts`: `npm install`, `{{nodePin}}`, no Bun.
- `lib/lint.ts`: `npm install -D` in messages.
- `cli/index.ts`: no change expected beyond import extensions.

Exit: `npx`-style smoke test passes from a packed tarball on Node 22.18.

### Phase 3 - Templates and docs

- Update `templates/package.json`, `templates/tsconfig.json`, and any `.gitkeep`
  layout that mentions Bun.
- Update `AGENTS.md`, `README.md`, `docs/install.md`,
  `plugins/script-forge/README.md`, and manifest keywords.
- Regenerate the three command adapters.

Exit: `npm run validate` and `git diff --exit-code` are clean.

### Phase 4 - Anvil assets

- Rewrite `assets/runner.ts` against the JSON store.
- Update `stepSchema.ts` import extensions.
- Add runner tests (there are none today): resume skips done steps, failed
  steps replay, orphans require confirmation, atomic write survives a torn
  temp file.

Exit: runner tests pass on 22.18 and 26; no `bun:` import remains.

### Phase 5 - Rulebook and references

- Apply the replacements listed above across `assets/script-forge.md` and the
  six anvil references.
- Update `docs/adr/0001-plugin-collection-layout.md` to mark section 7 and the
  Bun-workspace consequence as superseded by ADR 0002.
- Flip ADR 0002 to accepted.

Exit: a case-insensitive search for `bun` returns only historical ADR/plan
text and the optional development note, if any.

## Verification

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run validate
npm run build:commands
git diff --exit-code
npm run build
npm pack --dry-run
node dist/cli/index.js version
```

Plus the Phase 0 Cowork probe, repeated after the migration:

- `npx -y glowing-trefoil scaffold --yes ...` in a Cowork task.
- `npm install` in the generated workspace.
- `npm test` and `npm run tools:<name>` there.
- A runner-backed script that fails mid-run, then resumes.

## Risks

| Risk | Mitigation |
| --- | --- |
| Cowork has no Node, or Node < 22.18 | Phase 0 blocks the plan; distribution model must change. |
| npm registry unreachable in Cowork | Documented "Package managers only" tier reaches `registry.npmjs.org`; verify with `npx`. |
| Node 22 TS behavior changes in a patch | CI pins 22.18 and 26; keep syntax erasable; no transform flags. |
| `node --test` TS discovery differs on 22.18 | CI floor job catches it; fall back to explicit test file globs. |
| npm is slower than Bun in CI | Accept; cache npm; the repo is small. |
| JSON store loses SQL ergonomics | The runner only does keyed lookups; no queries are used. |
| Removing Bun breaks a contributor's workflow | Document `npm` commands in `AGENTS.md`; keep Bun optional, not required. |

## Open questions

1. **Is Cowork's Node actually 22.22?** Phase 0 answers this. Everything else
   is contingent.
2. **Strict or operational "no experimental"?** This plan assumes operational.
   If strict, generated workspaces must compile before running, which is a
   different (and heavier) design.
3. **Keep Bun as an optional local test runner?** Recommendation: no. One
   documented path is easier to keep correct.
4. **Single-file CLI or `tsc` tree?** Recommendation: `tsc` tree. Revisit only
   if package size or cold start becomes a measured problem.
5. **Does any consumer run generated workspaces on Node < 22.18?** If yes, add a
   `tsc` build step to the template rather than lowering the floor.

## Sources

- Node.js v22 TypeScript docs (Stability 1.2, `node_modules` restriction,
  feature limits): <https://nodejs.org/docs/latest-v22.x/api/typescript.html>
- Node.js 22.18.0 release notes (type stripping on by default, "experimental",
  `import.meta.main`): <https://nodejs.org/en/blog/release/v22.18.0>
- Node.js v24 TypeScript docs (Stability 2): <https://nodejs.org/docs/latest-v24.x/api/typescript.html>
- Node.js release schedule: <https://nodejs.org/en/about/previous-releases>
- Cowork platform support (VM, component support, no `bin/`):
  <https://claude.com/docs/plugins/platform-support>
- Cowork network access (package-manager tier, download-only registry):
  <https://claude.com/docs/cowork/guide/network-access>
- Local research: `harness-matrix.md` (harness comparison), `cowork-vm.md`
  (Cowork runtime evidence), `node-ts.md` (Node TypeScript matrix)
