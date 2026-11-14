# Principles

> Source: Script Forge rulebook, **Principles**. Always follow these principles, to the letter.

## 📊 No Naked Data

> Never let raw data reach the coding assistant's own context: while investigating or debugging, build TypeScript scripts that read the full dataset but print only anonymized statistics back to the terminal.

> ⚠️ This principle applies specifically to the coding assistant's context (e.g., terminal output, file reads during development), not to every LLM call executed by a running script. It also covers error objects and stack traces: sanitize them before logging and never dump raw rows from catch blocks. Local database inspection must use the same stats-only script pattern; never run raw `sqlite3 ... select *` output into the assistant's context. Local/self-hosted LLM calls are exempt from external-vendor privacy scrutiny, but not from the terminal/context exposure rule. Refer to **Domain Patterns → LLM Integration & Orchestration** for handling LLMs in scripts.

> Paths in the examples: `local/` = `<localDir>` (default `local`), `scripts/` = `<scriptsDir>` (default `scripts`).

**✅ GOOD — scripts only, stats out**

```ts
// local/tmp/ordersSummary.ts — run with: node local/tmp/ordersSummary.ts
// The script reads the dump, but only anonymized statistics reach the screen (and the assistant).
// This illustrative example assumes a small, size-bounded file; unknown or large inputs must use streaming/chunked ingestion.
import { readFile } from "node:fs/promises";
import { z } from "zod";

// Zod validates every row before any computation touches it.
const orderRow = z.object({
  date: z.string(),
  customer: z.string(),
  amount: z.number().positive(),
});

const [, ...lines] = (await readFile("local/raw_data/orders.csv", "utf8"))
  .trim()
  .split("\n");

const rows = lines.map((line) => {
  const [date, customer, amount] = line.split(",");
  return orderRow.parse({ date, customer, amount: Number(amount) });
});

const totalOrders = rows.length;
const avgOrderValue =
  rows.reduce((sum, row) => sum + row.amount, 0) / totalOrders;

console.log({ totalOrders, avgOrderValue });
// → { totalOrders: 1284, avgOrderValue: 42.5 }
```

**❌ BAD — reading the dump directly**

```bash
# 🚫 The raw dump (customer names, emails, amounts) passes straight through to the assistant's context.
cat local/raw_data/orders.csv | head -50
```

```ts
// 🚫 Same problem: this prints every raw row, PII and all.
import { readFile } from "node:fs/promises";
console.log(await readFile("local/raw_data/orders.csv", "utf8"));
```

## 🧹 Clean Kitchen

> You own the code you're writing or evolving. Your scope always includes fixing pre-existing bugs and technical debt directly touched by or adjacent to the current diff. Your responsibility is to evolve the codebase so it stays readable, tidy and scalable — leave the kitchen cleaner than you found it. Unrelated issues spotted along the way are out of scope for inline fixes: surface them to the user, or log them to the client's persistent memory when available, rather than expanding the diff.

> For the concrete readability rules — decomposition, naming, comments, script structure — see **Code Standards → Readability**.

**✅ GOOD — you own it, leave it cleaner**

```ts
// 🎯 Task: add a `--json` flag to scripts/ordersSummary/steps/summarize.ts.
// While editing, you spot a pre-existing bug: averages are computed on rows
// that were never validated with Zod. Not your bug? Doesn't matter — you own
// this code now. Fix it and pin the fix with a regression test.

const rows = lines.map(parseLine); // ✅ Zod-validated (was: raw split lines)
const avgOrderValue =
  rows.reduce((sum, row) => sum + row.amount, 0) / rows.length;
```

**❌ BAD — "not my bug", leave a mess**

```ts
// 🎯 Same task. The pre-existing bug stays, hidden behind a TODO "for later",
// and a scratch file is dumped next to the script — nobody cleans up after you.

const rows = lines.map(parseLine);
const avg =
  rows.reduce((sum, row) => sum + Number(row.amount), 0) / rows.length; // TODO: fix later

await writeFile("debug.json", JSON.stringify(rows)); // 💩 dumped, never cleaned
```

## 🔁 Checkpoint & Resume

> Multi-step scripts persist state per step and are re-runnable from any step. Every side effect is logged with its own compensating (rollback) action — or an explicit `null` if none exists — so a failed run can be resumed or unwound without guesswork.

**State store** — one JSON file per script run under `<localDir>/state/` (default `local/state/`), not a database: the runner writes each checkpoint to a temporary file, fsyncs it, and renames it over the state file, so a crash cannot leave a half-written checkpoint. The runner is the only writer, so no file lock is needed. `local/state/` is gitignored and survives `local/tmp` sweeps. This is a run-state file, separate from any output files the script writes under **Domain Patterns → Data I/O**. A row per step, minimally:

```ts
const stepRow = z.object({
  step: z.string(),
  status: z.enum(["pending", "done", "failed"]),
  ranAt: z.string(), // ISO timestamp
  action: z.string(), // JSON describing what this step did and any state needed for resume/postmortem
  rollback: z.string().nullable(), // compensating action description, or null if none exists
});
```

**Resume** — resume happens in a fresh process. No step may assume in-memory continuity: required inputs must either be re-derived from source/build output or be persisted in the state's `action` field as JSON and re-read on resume. On start, read the state file; skip steps marked `done`, restart from the first `pending` or `failed` row.

**Dynamic step reconciliation** — on resume, rows in the state file with no matching step in the current composition are flagged as **orphaned** and require explicit confirmation before proceeding. Steps present in the current composition with no state row start fresh as `pending`.

**Rollback (the Corollary, made concrete)** — on failure, replay `done` rows in reverse. If the current step definition provides `rollbackFn`, invoke it; otherwise surface the descriptive `rollback` string as a required manual action for the operator. A `null` rollback is not a silent gap: it's a recorded fact Planning can check for — any step with `rollback: null` must carry an explicit warning raised during Planning, per the Implementing corollary.

**Torn state & idempotency** — mark a step `done` only after the atomic state write succeeds. Every step that performs an external side effect must be idempotent or use a check-before-act strategy that queries the external system for an existing effect, so a resume retry after a torn state cannot duplicate the side effect.

> The engine that implements all of the above lives in `assets/runner.ts` (with `assets/stepSchema.ts`) — scripts copy both into `scripts/<name>/commons/`. See **lifecycle.md → Step Orchestration** for how `index.ts` composes and runs steps.

## 🚫 Eval is Banned

> Never execute inline code to inspect the repository or the data. Order of preference for investigating:
> 1. **Your client's file read and search tools** — always first.
> 2. **Shell tools** — a structured shell (PowerShell) when the task needs object piping, multi-step file or registry manipulation, or Windows-specific tooling; a POSIX shell (Bash) for everything else.
> 3. **Temp-tools** — if you need a real script, write one (see Scaffolding).
> Never use `eval()` or other inline executions. Don't use **Python** or other scripting languages.

> Paths in the examples: `local/` = `<localDir>` (default `local`).

**✅ GOOD — tools first, scripts for the rest**

```bash
# 1. Inspect with your client's file read and search tools.
# 2. Shell work — Bash for simple cases:
ls local/tmp
# 2. Shell work — PowerShell for structured/Windows-specific cases (not shown)

# 3. Real data crunching → write a temp-tool (see No Naked Data):
node local/tmp/extractStats.ts
```

**❌ BAD — inline execution, never**

```bash
# 🚫 The raw dump (PII and all) passes straight through to the assistant's context.
node -e "console.log(require('fs').readFileSync('local/raw_data/orders.csv', 'utf8'))"
```

```js
// 🚫 eval() and friends — banned, no exceptions.
eval("console.log(fs.readFileSync('local/raw_data/orders.csv', 'utf8'))");
```

```bash
# 🚫 Other scripting languages are banned too.
python -c "print(len(open('local/raw_data/orders.csv').readlines()))"
```

## 🔒 Never Read `.env`

> Secrets never enter the session: `.env` is never read as a file — prefix the script alias with `node --env-file-if-exists=.env` (see **Tech Stack**), so config comes from `process.env`.

**✅ GOOD — config via process.env**

```ts
const apiToken = process.env.API_TOKEN; // loaded by --env-file-if-exists
```

**❌ BAD — reading the file**

```ts
import { readFile } from "node:fs/promises";
const secrets = await readFile(".env", "utf8"); // 🚫 secrets pass through the session
```

> ESLint bans this too (`no-restricted-syntax`), and lint covers the temp-tools directory — this principle carries the rule for temp-tools.

## 🧠 Memory

> Durable conventions and facts you state belong in **this doc** — not in the client's persistent memory. What the assistant discovers *while working* (build quirks, debug insights, preferences you mention in passing) goes to the client's persistent memory, auditable through the client's memory surface when it has one.
