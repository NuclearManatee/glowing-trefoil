import assert from "node:assert/strict";
import { test } from "node:test";

// Keeps `npm test` green in a fresh workspace and shows the Node test style.
test("workspace test runner is wired", () => {
	assert.equal(1 + 1, 2);
});
