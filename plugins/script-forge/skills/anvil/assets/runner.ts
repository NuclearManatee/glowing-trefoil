// runner.ts — checkpoint & resume engine (rulebook: Principles → Checkpoint & Resume).
// Scripts copy this file into scripts/<name>/commons/ together with stepSchema.ts.
//
// State is one JSON file per script run. Every write goes to a temporary file,
// is fsynced, then renamed over the target, so a crash leaves either the
// previous complete state or the new one — never a half-written file.
//
// Why not SQLite: node:sqlite is experimental on Node 22 and prints a runtime
// warning. The runner only needs keyed lookups and a single writer, so a JSON
// file is sufficient and dependency-free.
//
// index.ts pattern (exit-code taxonomy, fail fast):
//   const runner = new StepRunner("local/state/orders.json", stepList.parse([...]));
//   try {
//     await runner.run();
//   } catch (error) {
//     console.log({ error: (error as Error).message, category: (error as RunError).category ?? "internal" });
//     process.exit(EXIT_BY_CATEGORY[(error as RunError).category ?? "internal"]);
//   } finally {
//     runner.close();
//   }
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import type { StepDef, StepContext } from "./stepSchema.ts";

export type StepStatus = "pending" | "done" | "failed";

export interface StepRow {
	step: string;
	status: StepStatus;
	ranAt: string;
	action: string;
	rollback: string | null;
}

export type ErrorCategory = "user" | "environment" | "external" | "internal";

export class RunError extends Error {
	readonly category: ErrorCategory;
	constructor(message: string, category: ErrorCategory) {
		super(message);
		this.name = "RunError";
		this.category = category;
	}
}

export interface RunOptions {
	// Rows in the state file with no matching step in the current composition
	// (rulebook: dynamic step reconciliation). Resume must not proceed without
	// explicit confirmation — pass a callback wired to the client's ask-the-user
	// tool, or to readline.
	// Default: abort with a user-category error.
	confirmOrphans?: (orphans: string[]) => boolean | Promise<boolean>;
	// A failed step whose definition has no rollbackFn: surface the descriptive
	// rollback string as a required manual action (rulebook: rollback corollary).
	onManualRollback?: (step: string, rollback: string) => void;
}

type State = {
	version: 1;
	steps: StepRow[];
	context: Record<string, unknown>;
};

type ContextStore = {
	context(): Record<string, unknown>;
	setContext(key: string, value: unknown): void;
};

function emptyState(): State {
	return { version: 1, steps: [], context: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoredRow(value: unknown): value is StepRow {
	if (!isRecord(value)) {
		return false;
	}
	return (
		typeof value.step === "string" &&
		(value.status === "pending" || value.status === "done" || value.status === "failed") &&
		typeof value.ranAt === "string" &&
		typeof value.action === "string" &&
		(value.rollback === null || typeof value.rollback === "string")
	);
}

function isState(value: unknown): value is State {
	if (!isRecord(value)) {
		return false;
	}
	return (
		value.version === 1 &&
		Array.isArray(value.steps) &&
		value.steps.every(isStoredRow) &&
		isRecord(value.context)
	);
}

function loadState(path: string): State {
	if (!existsSync(path)) {
		return emptyState();
	}
	const raw = readFileSync(path, "utf8");
	if (raw.trim() === "") {
		throw new RunError(`state file is empty: ${path} — delete it to start a fresh run`, "environment");
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new RunError(`state file is not valid JSON: ${path} (${detail})`, "environment");
	}
	if (!isState(parsed)) {
		throw new RunError(`state file has an unsupported shape: ${path}`, "environment");
	}
	return parsed;
}

function writeStateAtomic(path: string, state: State): void {
	const temporary = `${path}.${process.pid}.tmp`;
	const content = `${JSON.stringify(state, null, "\t")}\n`;
	const descriptor = openSync(temporary, "w");
	try {
		writeSync(descriptor, content, null, "utf8");
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
	try {
		renameSync(temporary, path);
	} catch (error) {
		rmSync(temporary, { force: true });
		throw error;
	}
}

class StateStore implements ContextStore {
	readonly path: string;
	readonly state: State;

	constructor(path: string) {
		this.path = path;
		mkdirSync(dirname(path), { recursive: true });
		this.state = loadState(path);
	}

	rows(): StepRow[] {
		return this.state.steps;
	}

	row(step: string): StepRow | undefined {
		return this.state.steps.find((candidate) => candidate.step === step);
	}

	has(step: string): boolean {
		return this.row(step) !== undefined;
	}

	addPending(step: StepDef): void {
		this.state.steps.push({
			step: step.name,
			status: "pending",
			ranAt: "",
			action: "{}",
			rollback: step.rollback,
		});
	}

	markDone(step: string, action: string): void {
		const row = this.row(step);
		if (row === undefined) {
			throw new RunError(`cannot mark unknown step done: ${step}`, "internal");
		}
		row.status = "done";
		row.ranAt = new Date().toISOString();
		row.action = action;
	}

	markFailed(step: string, action: string): void {
		const row = this.row(step);
		if (row === undefined) {
			throw new RunError(`cannot mark unknown step failed: ${step}`, "internal");
		}
		row.status = "failed";
		row.action = action;
	}

	context(): Record<string, unknown> {
		return this.state.context;
	}

	setContext(key: string, value: unknown): void {
		let serialized: string | undefined;
		try {
			serialized = JSON.stringify(value);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			throw new RunError(`context value for "${key}" is not JSON-serializable: ${detail}`, "internal");
		}
		if (serialized === undefined) {
			throw new RunError(`context value for "${key}" is not JSON-serializable`, "internal");
		}
		this.state.context[key] = JSON.parse(serialized) as unknown;
		this.save();
	}

	save(): void {
		writeStateAtomic(this.path, this.state);
	}
}

// Per-step context. get/set read and write a persisted per-run key-value store
// in the state file, so resume in a fresh process can re-hydrate anything a step
// needs that it cannot re-derive from source/build output. Steps persist what
// resume needs via set(); the runner snapshots each step's context into the
// step row's action field after it completes (resume + postmortem).
export class RunContext implements StepContext {
	private readonly store: ContextStore;
	constructor(store: ContextStore) {
		this.store = store;
	}
	// Arrow properties keep the store bound when zod's function schema passes
	// the context through as a parsed object instead of the class instance.
	readonly get = (key: string): unknown => {
		const value = this.store.context()[key];
		// Clone so a step cannot mutate persisted state by editing the returned
		// object; the old SQLite store returned a fresh parse on every get.
		return value === undefined ? undefined : structuredClone(value);
	};
	readonly set = (key: string, value: unknown): void => {
		this.store.setContext(key, value);
	};
}

export class StepRunner {
	private readonly store: StateStore;
	private readonly steps: StepDef[];
	private readonly options: RunOptions;
	private readonly byName = new Map<string, StepDef>();

	constructor(statePath: string, steps: StepDef[], options: RunOptions = {}) {
		this.store = new StateStore(statePath);
		this.steps = steps;
		this.options = options;
		for (const step of steps) {
			if (this.byName.has(step.name)) {
				throw new RunError(`duplicate step name: ${step.name}`, "user");
			}
			this.byName.set(step.name, step);
		}
	}

	// Reconciliation: insert a pending row for every step not yet tracked;
	// flag rows with no matching step as orphaned and require confirmation.
	// "Mark done only after its local write/checkpoint succeeds" — rows are
	// only ever written done by run() after the step's run() resolves.
	private async reconcile(): Promise<void> {
		let added = false;
		for (const step of this.steps) {
			if (!this.store.has(step.name)) {
				this.store.addPending(step);
				added = true;
			}
		}
		if (added) {
			this.store.save();
		}
		const orphans = this.store
			.rows()
			.map((row) => row.step)
			.filter((name) => !this.byName.has(name));
		if (orphans.length > 0) {
			const confirm = this.options.confirmOrphans;
			if (confirm === undefined || !(await confirm(orphans))) {
				throw new RunError(
					`orphaned state rows require explicit confirmation: ${orphans.join(", ")}`,
					"user",
				);
			}
		}
	}

	async run(): Promise<void> {
		await this.reconcile();
		const context = new RunContext(this.store);
		for (const step of this.steps) {
			const row = this.store.row(step.name);
			if (row?.status === "done") {
				// Re-hydrate persisted context so later steps see values from
				// before the resume point (no in-memory continuity is assumed).
				console.log({ step: step.name, status: "done", resumed: true });
				continue;
			}
			console.log({ step: step.name, status: "running" });
			try {
				await step.run(context);
			} catch (error) {
				await this.failAndRollback(step, context, error);
				throw error instanceof RunError
					? error
					: new RunError(error instanceof Error ? error.message : String(error), "internal");
			}
			// Snapshot the step's context as its action; mark done and persist in
			// one atomic write.
			this.store.markDone(step.name, JSON.stringify(this.store.context()));
			this.store.save();
			console.log({ step: step.name, status: "done" });
		}
	}

	// On failure: replay done rows in reverse; rollbackFn when the definition
	// has one, else surface the descriptive rollback string as a required
	// manual action — never a silent gap. Waits for each rollbackFn so the
	// process cannot exit mid-replay.
	private async failAndRollback(failed: StepDef, context: RunContext, cause: unknown): Promise<void> {
		const detail = cause instanceof Error ? cause.message : String(cause);
		this.store.markFailed(failed.name, JSON.stringify({ cause: detail }));
		this.store.save();
		const doneInReverse = this.store
			.rows()
			.filter((row) => row.status === "done")
			.reverse();
		for (const row of doneInReverse) {
			const def = this.byName.get(row.step);
			const rollbackFn = def?.rollbackFn ?? null;
			if (rollbackFn !== null) {
				console.log({ step: row.step, status: "rollback" });
				try {
					await rollbackFn(context);
				} catch (error) {
					console.log({
						error: "rollback failed",
						category: "internal",
						step: row.step,
						detail: error instanceof Error ? error.message : String(error),
					});
				}
			} else if (this.options.onManualRollback !== undefined) {
				this.options.onManualRollback(row.step, row.rollback ?? "null");
			}
		}
	}

	close(): void {
		// The JSON store keeps no open handles; retained for API compatibility.
	}
}
