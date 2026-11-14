import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NODE_MIN, meetsMinimum, nodeVersion, npmCliPath } from "../plugins/script-forge/lib/runtime.ts";

describe("runtime helpers", () => {
	test("compares Node versions against the minimum", () => {
		assert.equal(meetsMinimum("22.18.0", NODE_MIN), true);
		assert.equal(meetsMinimum("22.18", NODE_MIN), true);
		assert.equal(meetsMinimum("22.17.9", NODE_MIN), false);
		assert.equal(meetsMinimum("23.0.0", NODE_MIN), true);
		assert.equal(meetsMinimum(">=22.18.0", NODE_MIN), true);
		assert.equal(meetsMinimum("^22.18.0", NODE_MIN), true);
		assert.equal(meetsMinimum(">=22", NODE_MIN), false);
		assert.equal(meetsMinimum("garbage", NODE_MIN), false);
	});

	test("reports the running Node version", () => {
		assert.match(nodeVersion(), /^\d+\.\d+\.\d+/);
	});

	test("resolves an npm CLI without a shell shim", () => {
		const cli = npmCliPath();
		assert.ok(cli !== null);
		assert.match(cli, /npm-cli\.js$/);
	});
});
