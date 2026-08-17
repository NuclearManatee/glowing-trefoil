# Code Standards

> Source: Script Forge rulebook, **Code Standards + Runtime & Architecture + Logging + Readability**. The ESLint rules live in the real config file — see below; this reference documents only what ESLint cannot enforce.

Code style and syntax rules are enforced by the repository ESLint configuration. Do not duplicate those rules here; this document defines only constraints that ESLint cannot reliably enforce or that describe runtime/architectural behavior.

## ESLint Configuration

The repository must contain the following ESLint configuration for tooling scripts:

**The config itself lives at `assets/eslint.tooling.js`** (the plugin's anvil assets) — the rulebook's config block, verbatim. Do not copy its rules into any project; projects point at the file by path (see the `lint` helper command / scaffold wiring). It enforces: strict typing (no explicit `any`, no unused vars, type-only imports), no eval-family constructs, double quotes / semicolons / tab indent, camelCase files & variables with PascalCase types, `prefer-const`/`no-var`/`prefer-destructuring`, no nested ternaries, top-level functions as declarations (arrows only for callbacks), and the domain bans: `dayjs`/`date-fns`/`moment`/`luxon` imports, `parseInt`, unary `+` parsing, `z.any()` (use `z.unknown()`), and direct `.env` file reads.

## Runtime & Architecture

* Run scripts with **Bun** + **TypeScript**.
* Untyped external data must pass through **Zod** at the ingress boundary; derive downstream types from the schema. ESLint can prohibit explicit `any`/`z.any()`, but cannot establish that every external input was correctly validated.
* When using `Number()` for parsing, pair the parsed value with Zod validation, including an explicit `.refine((value) => !Number.isNaN(value))` where `Number()` may produce `NaN`.
* **Fail fast** with early-exit guards, structured error logs, and non-zero exits; avoid nested error branches.

```ts
if (tocIndex < 0) {
	console.log({ error: "TOC page not found", category: "user" });
	process.exit(1);
}
```

The synchronous early-guard pattern above may use `process.exit(n)`. After pending asynchronous I/O has started, set `process.exitCode = n` and let the event loop drain so logs and streams are not truncated.

* Exit codes follow a fixed taxonomy — pair every `process.exit(n)` with the matching `category` in the error log:

| Code | Category | Meaning |
| --- | --- | --- |
| `0` | — | Success |
| `1` | `user` | Bad args, invalid/malformed data, Zod validation failure |
| `2` | `environment` | Missing env var, missing dependency, auth/config failure |
| `3` | `external` | API call failed, network timeout, upstream system down |
| `4` | `internal` | Unexpected/unhandled — treat as a bug, not a user problem |

Uncaught import-time failures can occur before the script can apply this taxonomy; those are outside taxonomy control and present as the runtime's default failure behavior.

`130` is reserved for `SIGINT` by convention — never repurpose it.

## Logging

* Log meaningful progress messages and end with a final summary object containing the result and counts.
* Progress and summary output is still terminal output: it must satisfy **No Naked Data**. Logs are aggregate/anonymized and contain no raw rows or secrets.
* All log output is plain, uncolored text. Tutor Mode and human execution consume the same stdout; there is no separate rendering path to justify ANSI formatting.

## Readability

> Readability means a step is understandable where it stands: a reader should not need to jump across files to see what a script step does. ESLint enforces syntax and style (see the config above); this section covers what lint cannot check.

**Decomposition**

* One purpose per function — if describing what it does needs an "and", split it.
* Keep the flow shallow by extracting small, well-named sub-functions: the main body reads top-down as a list of named calls, and each sub-function is small enough to grasp in place.
* **Prefer co-located sub-functions over new files.** A step's helpers live with the step so it can be understood from its own file. Files exist for composition boundaries (steps, `commons/`), not for readability.
* Avoid nested `if`/`else` — early-exit guards (see **Fail fast** above) keep depth shallow; beyond three levels of nesting, extract.

**Naming**

* Names say what a thing is, not where it came from: `orders` not `result`, `rowCount` not `data`.
* No abbreviations beyond the conventional: `config` yes, `cfg` no.
* Booleans read as predicates: `isValid`, `hasHeader`, `shouldRetry`.
* Never reuse one name for two meanings; don't shadow an outer binding with a local.
* Repeated literals become named constants — `API_TIMEOUT_MS` beats a bare `30_000` appearing twice.

**Comment policy**

* **Why-comments** explain the reasoning behind code, never restate what the code does.
* If a comment is needed to explain what code does, the code needs a name or a split instead — restating comments are noise.
* No commented-out code: delete it, git history owns it.
* Comments carry intent and invariants: why a step exists, what a state row must contain, why a retry is safe.

**Script structure**

* `index.ts` is a thin orchestrator: composes steps, wires inputs/outputs, contains no business logic.
* Steps are self-contained and named for what they do — readable in isolation, no cross-file context required (see **lifecycle.md → Step Orchestration**).
* Vocabulary consistency: step names, checkpoint state, and log messages use the same terms, so a resume or postmortem reads like the composition.
