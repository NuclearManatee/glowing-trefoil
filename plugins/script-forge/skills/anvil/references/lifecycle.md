# Lifecycle

> Source: Script Forge rulebook, **Scaffolding + Step Orchestration + Implementation**. Where scripts live, how they're structured, and the four phases every script goes through: Planning → Implementing → Validating → Running.

## Scaffolding

> Where a script lives depends on its lifecycle stage: disposable investigation vs. a permanent, referenceable tool.

### Temp-tools → `<localDir>/tmp` (default `local/tmp`)

* One-off scripts for Planning or investigating go into `<localDir>/tmp` (gitignored — default `local/tmp`).
* Raw datasets are dropped into `<localDir>/raw_data` (gitignored) — see **No Naked Data**.
* You may decide to promote a temp-tool into a proper script (see below). If so, propose it to the User first.
* Treat `<localDir>/tmp` as fully disposable — no persistence guarantee, no mid-session cleanup ceremony.
* On promotion to `<scriptsDir>/`, delete the temp-tool version in the same commit — Clean Kitchen applies to the file's own lifecycle too.
* At the start of a new planning session, sweep `<localDir>/tmp` of anything not referenced by the current task — judgment call, no fixed TTL.
* If something in `<localDir>/tmp` needs to survive across sessions, that's a signal to either promote it or log the reason to the client's persistent memory when available — not leave it implicit.

### Proper scripts → `<scriptsDir>/<scriptname>/`

* **Every proper script uses this structure, with no exception for mono-step scripts.** A script small enough to fit in one file still gets the full layout below — consistency across `<scriptsDir>/` (default `scripts/`) matters more than saving a folder for trivial cases.

```
<scriptsDir>/<scriptname>/
├── index.ts               # entrypoint — orchestrates steps, see Step Orchestration
├── commons/                # functions shared across steps
├── steps/                  # one .ts file per step (or a generic file for dynamically-generated steps)
├── tests/
│   ├── bun/                 # unit + integration tests (*.test.ts)
│   ├── playwright/          # optional, e2e tests
│   └── fixtures/            # shared by bun test and playwright
├── assets/
│   └── prompts/             # optional, LLM prompt files (see LLMs → Prompt Files)
└── README.md               # required, see Documentation
```

* Reference every script in `package.json` as `<namespace>:<scriptname>` and run it from there with **Bun**, e.g. `"tools:ordersSummary": "bun run scripts/ordersSummary/index.ts"` (= `<scriptsDir>`) → `bun run tools:ordersSummary`. `<namespace>` groups scripts by domain (e.g. `tools`, `reports`) — reuse an existing namespace when the script fits one, don't mint a new one per script. Use the default namespace from `<namespace>` unless the script belongs to an existing one.

## Step Orchestration

> `index.ts` composes the step list before running it. Step order can be dynamic — built with plain `if`/`else` and `for`-loops — rather than encoded in filenames. This is deliberately handled in-house: LangGraph and similar graph/agent-orchestration libraries are rejected (see **LLMs → Surface Area Constraint**) because they duplicate and compete with **Checkpoint & Resume** rather than complement it.

**Step schema** — the zod schemas (`stepContext`, `stepDef`, `stepList`) live in `assets/stepSchema.ts` (anvil asset); scripts copy it into `commons/stepSchema.ts`. It validates: `name` (matches `stepRow.step` in the state db), `run(ctx)`, `rollback` (compensating-action description or `null`), `rollbackFn(ctx)` (or `null`).

**Checkpoint & Resume engine** — `assets/runner.ts` (anvil asset) implements the full engine: per-run `bun:sqlite` state DB in WAL mode, skip `done` rows on resume, restart from the first `pending`/`failed` row, orphaned-row reconciliation with explicit confirmation, mark-done-only-after-write, and reverse-replay rollback invoking `rollbackFn` or surfacing the `rollback` string as a manual action. Scripts copy it into `commons/runner.ts` together with `stepSchema.ts`.

**Dynamic composition — conditional step + loop-generated steps** (`index.ts`):

```ts
import { stepList } from "./commons/stepSchema";
import { fetchStep, validateStep, enrichStep, writeStep, perRegionStep } from "./steps";
import { runStep } from "./commons/runner"; // wraps Checkpoint & Resume sqlite logic

const needsEnrichment = process.env.ENRICH === "1";
const regions = ["eu", "us", "apac"];

const steps = stepList.parse([
  { name: "fetch", run: fetchStep, rollback: null, rollbackFn: null },
  { name: "validate", run: validateStep, rollback: null, rollbackFn: null },
  ...(needsEnrichment
    ? [{ name: "enrich", run: enrichStep, rollback: "delete enrichment cache", rollbackFn: null }]
    : []),
  ...regions.map((region) => ({
    name: `write_${region}`,
    run: () => perRegionStep(region),
    rollback: `delete output rows for region=${region}`,
    rollbackFn: null,
  })),
  { name: "write_summary", run: writeStep, rollback: null, rollbackFn: null },
]);

for (const step of steps) {
  await runStep(step);
}
```

> The example above shows the composition pattern; when building the real `index.ts`, use the actual `StepRunner` exported by the copied `commons/runner.ts` (constructor takes the state-db path + parsed step list; `run()` executes, handles resume and rollback). See its header comment for the entrypoint error-handling pattern.

`null` rollbacks still require an explicit Planning-time warning per the **Checkpoint & Resume** corollary — dynamic composition doesn't exempt any step from that rule.

## Planning

Use your client's plan mode when the approach is uncertain, the change spans multiple files, or the code is unfamiliar — skip it when the diff is describable in one sentence. A good plan:

* Is backed by extensive research.
* Uses **subagents** (the delegation tool) that return **structured, synthetic findings** to preserve the session scope.
* Uses **web search and fetch tools** (always wrapped in a subagent) to ground and validate products or pattern best practices.
* Always applies **No Naked Data** in your investigations.
* Has a clear and validated scope.
* **Discovery before questions:** investigate first using file read/search tools, web search/fetch tools, and subagents. Agent-side resolution is preferred when the codebase or available evidence can answer the question without user input.
* Only unresolved questions go to the user via sequential **ask-the-user** batches of approximately 2–4 questions, grouped by topic, with a hard cap of 2 batches (about 8 questions total). If open questions remain after that, proceed with explicit **⚠️ Assumptions** in the plan that the user can veto rather than continuing to ask.
* Outlines a clear series of steps with clear boundaries that brings you to the goal with certainty, without skipping any.
* Includes validation steps and checkpoints to raise quality (see Validating).
* Ends with a final step to update the script's own `README.md` (see **Documentation**).

## Implementing

* Scripts should be executable in a single **bash** command.
* Apply **Checkpoint & Resume** (see Principles): multi-step scripts maintain state per step and are re-runnable from any step; on error, restart from the last available checkpoint.
* Corollary: side effects must be documented and have a clear rollback procedure, per **Checkpoint & Resume**. If a rollback isn't possible, a warning must be raised during Planning.
* Scripts should log meaningful progress messages and errors: `console.log()` output should be tested so it can be used for troubleshooting.
* Scripts — especially when for-loops are involved — should be optimized for speed and parallelism (see Pre-authorized libraries: `p-limit`, `bottleneck`).
* Aim for a **Clean Kitchen**.

## Validating

* Validate TypeScript types: `bunx tsc --noEmit`.
* Validate syntax with **ESLint**: `bun run lint`.
* Write and run unit tests and integration tests, following a TDD approach: `RED` → `GREEN` → `REFACTOR`.
* Unit tests should cover positives, negatives, edge cases, faults and error handling.
* Integration tests should also account for failures and errors from external systems (executed commands, API calls, etc.).
* **Unit tests** never touch the network — mock the API client/fetch call entirely, no exception.
* **Third-party API fixtures:** prefer, in order: (1) obtain a real example response from the API's own docs via the web search/fetch tools, or ask the user to paste one from their own account/logs if docs are thin or gated; no live call is required for this path; (2) if that fails, use record-then-mock only with explicit user authorization, making one real **sandboxed** call to capture the response shape and persisting it as a fixture; (3) hand-author a mock from memory only as a last resort, and flag it as unverified in the README/PR.
* **Complex third-party APIs:** a record-then-mock workflow is permitted: implement against the sandbox, capture real responses into fixtures, then backfill tests. Keep strict RED → GREEN → REFACTOR for pure logic and transformation code.
* **Integration tests** should otherwise use recorded fixtures/mocks rather than live APIs by default; do not instrument the shipped script for test mode solely to enable this. Set `RUN_MOCK_API_TESTS=1` when isolating an execution against recorded fixtures is useful (success, rate-limit, 4xx, 5xx, malformed response — one file per scenario, under `tests/fixtures/`).
* Fixture content follows **No Naked Data**: no real tokens, real PII, or real customer data.
* Write and run E2E tests with **Playwright** if the requirements cover multiple use cases (one file per use case, one test per use-case variation).

## Running

Always run scripts in **Tutor Mode**: you watch the logs while the assistant drives the script — fix, restart from checkpoint, postmortem.

* The session stays open and you watch the logs as the script runs.
* On a technical error or bug, aim for a **Clean Kitchen**: fix it, then restart from the last available checkpoint (or from the start, worst case).
* The natural termination of the script (Success or Functional Error) is followed by a postmortem execution summary from your end.

> **Run the script only after the User's explicit consent.** "The script" means a real invocation of `<scriptsDir>/<name>` that performs the requested business operation. Validation commands (`tsc`, ESLint, tests) and disposable `<localDir>/tmp` investigation tools are implicitly authorized as part of the workflow and do not require per-run consent.
