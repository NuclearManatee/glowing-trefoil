import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { RunError, StepRunner } from "../plugins/script-forge/skills/anvil/assets/runner.ts";
import { stepList, type StepDef } from "../plugins/script-forge/skills/anvil/assets/stepSchema.ts";

const roots: string[] = [];

function temporaryRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "gt-runner-"));
	roots.push(root);
	return root;
}

function statePath(root: string): string {
	return join(root, "run.state.json");
}

function step(
	name: string,
	run: StepDef["run"],
	rollback: string | null = null,
	rollbackFn: StepDef["rollbackFn"] = null,
): StepDef {
	return { name, run, rollback, rollbackFn };
}

type SavedState = {
	steps: { step: string; status: string; ranAt: string; action: string; rollback: string | null }[];
	context: Record<string, unknown>;
};

after(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("runner", () => {
	test("runs steps, snapshots context, and persists the state file", async () => {
		const root = temporaryRoot();
		const path = statePath(root);
		const runner = new StepRunner(
			path,
			stepList.parse([
				step("fetch", async (context) => {
					context.set("token", "abc");
				}),
				step("write", async (context) => {
					assert.equal(context.get("token"), "abc");
				}),
			]),
		);

		await runner.run();
		runner.close();

		const state = JSON.parse(readFileSync(path, "utf8")) as SavedState;
		assert.deepEqual(state.steps.map((row) => row.status), ["done", "done"]);
		assert.equal(state.context.token, "abc");
		assert.ok(state.steps.every((row) => row.ranAt !== ""));
		assert.ok(state.steps.every((row) => row.action.includes("token")));
	});

	test("resumes after a failure without re-running done steps", async () => {
		const root = temporaryRoot();
		const path = statePath(root);
		const calls: string[] = [];

		const first = new StepRunner(
			path,
			stepList.parse([
				step("a", async () => {
					calls.push("a");
				}),
				step("b", async (context) => {
					calls.push("b-fail");
					context.set("token", "kept");
					throw new Error("boom");
				}),
			]),
		);

		await assert.rejects(first.run(), /boom/);
		first.close();

		const second = new StepRunner(
			path,
			stepList.parse([
				step("a", async () => {
					calls.push("a-again");
				}),
				step("b", async (context) => {
					calls.push("b-retry");
					assert.equal(context.get("token"), "kept");
				}),
				step("c", async () => {
					calls.push("c");
				}),
			]),
		);

		await second.run();
		second.close();

		assert.deepEqual(calls, ["a", "b-fail", "b-retry", "c"]);
		const state = JSON.parse(readFileSync(path, "utf8")) as SavedState;
		assert.deepEqual(state.steps.map((row) => row.status), ["done", "done", "done"]);
	});

	test("replays done steps in reverse order on failure", async () => {
		const root = temporaryRoot();
		const path = statePath(root);
		const rollbacks: string[] = [];

		const runner = new StepRunner(
			path,
			stepList.parse([
				step("a", async () => {}, null, async () => {
					rollbacks.push("a");
				}),
				step("b", async () => {}, null, async () => {
					rollbacks.push("b");
				}),
				step("c", async () => {
					throw new RunError("upstream failed", "external");
				}),
			]),
		);

		await assert.rejects(runner.run(), (error: unknown) => {
			assert.ok(error instanceof RunError);
			assert.equal(error.category, "external");
			return true;
		});
		runner.close();

		assert.deepEqual(rollbacks, ["b", "a"]);
	});

	test("surfaces a manual rollback when no rollbackFn exists", async () => {
		const root = temporaryRoot();
		const path = statePath(root);
		const manual: string[] = [];

		const runner = new StepRunner(
			path,
			stepList.parse([
				step("a", async () => {}, "delete output rows"),
				step("b", async () => {
					throw new Error("boom");
				}),
			]),
			{
				onManualRollback: (name, rollback) => {
					manual.push(`${name}:${rollback}`);
				},
			},
		);

		await assert.rejects(runner.run(), /boom/);
		runner.close();

		assert.deepEqual(manual, ["a:delete output rows"]);
	});

	test("requires confirmation for orphaned state rows", async () => {
		const root = temporaryRoot();
		const path = statePath(root);

		const first = new StepRunner(
			path,
			stepList.parse([step("a", async () => {}), step("b", async () => {})]),
		);
		await first.run();
		first.close();

		const withoutConfirmation = new StepRunner(path, stepList.parse([step("a", async () => {})]));
		await assert.rejects(withoutConfirmation.run(), /orphaned state rows/);
		withoutConfirmation.close();

		const withConfirmation = new StepRunner(
			path,
			stepList.parse([step("a", async () => {})]),
			{ confirmOrphans: () => true },
		);
		await withConfirmation.run();
		withConfirmation.close();
	});

	test("ignores a stale temporary file", async () => {
		const root = temporaryRoot();
		const path = statePath(root);

		const first = new StepRunner(path, stepList.parse([step("a", async () => {})]));
		await first.run();
		first.close();

		writeFileSync(`${path}.999.tmp`, "not json\n", "utf8");

		const second = new StepRunner(
			path,
			stepList.parse([step("a", async () => {}), step("b", async () => {})]),
		);
		await second.run();
		second.close();

		const state = JSON.parse(readFileSync(path, "utf8")) as SavedState;
		assert.deepEqual(state.steps.map((row) => row.step), ["a", "b"]);
	});

	test("get returns a copy so mutations do not persist", async () => {
		const root = temporaryRoot();
		const path = statePath(root);
		const runner = new StepRunner(
			path,
			stepList.parse([
				step("a", async (context) => {
					context.set("payload", { count: 1 });
				}),
				step("b", async (context) => {
					const payload = context.get("payload") as { count: number };
					payload.count = 99;
					assert.equal((context.get("payload") as { count: number }).count, 1);
				}),
			]),
		);

		await runner.run();
		runner.close();
		const state = JSON.parse(readFileSync(path, "utf8")) as SavedState;
		assert.deepEqual(state.context.payload, { count: 1 });
	});

	test("rejects duplicate step names", () => {
		const root = temporaryRoot();
		assert.throws(
			() =>
				new StepRunner(
					statePath(root),
					stepList.parse([step("a", async () => {}), step("a", async () => {})]),
				),
			/duplicate step name/,
		);
	});

	test("rejects a corrupt state file instead of starting fresh", async () => {
		const root = temporaryRoot();
		const path = statePath(root);
		writeFileSync(path, "{ nope\n", "utf8");

		assert.throws(() => new StepRunner(path, stepList.parse([step("a", async () => {})])), /not valid JSON/);
	});

	test("rejects an empty state file", async () => {
		const root = temporaryRoot();
		const path = statePath(root);
		writeFileSync(path, "", "utf8");

		assert.throws(() => new StepRunner(path, stepList.parse([step("a", async () => {})])), /state file is empty/);
	});

	test("rejects context values that cannot be serialized", async () => {
		const root = temporaryRoot();
		const path = statePath(root);
		const runner = new StepRunner(
			path,
			stepList.parse([
				step("a", async (context) => {
					context.set("big", 1n);
				}),
			]),
		);

		await assert.rejects(runner.run(), /not JSON-serializable/);
		runner.close();
		assert.ok(existsSync(path));
	});
});
