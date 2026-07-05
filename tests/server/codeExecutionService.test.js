/**
 * Tests for the sandboxed code execution service. These run real code
 * through the actual worker thread (not mocked) since this is the highest-
 * risk new component — the value of these tests is in exercising the real
 * sandbox boundary, not a stubbed approximation of it.
 */

const { runCode, deepEqual, unorderedDeepEqual } = require("../../server/services/codeExecutionService");

jest.setTimeout(15000);

describe("runCode", () => {
  test("a correct solution passes", async () => {
    const results = await runCode(
      "function add(a, b) { return a + b; }",
      "add",
      [{ args: [2, 3], expected: 5 }]
    );
    expect(results).toEqual([
      expect.objectContaining({ passed: true, actualOutput: 5 }),
    ]);
  });

  test("an incorrect solution fails without throwing", async () => {
    const results = await runCode(
      "function add(a, b) { return a - b; }",
      "add",
      [{ args: [2, 3], expected: 5 }]
    );
    expect(results[0].passed).toBe(false);
    expect(results[0].actualOutput).toBe(-1);
  });

  test("unordered compare mode ignores array order", async () => {
    const results = await runCode(
      "function pair() { return [1, 0]; }",
      "pair",
      [{ args: [], expected: [0, 1] }],
      "unordered"
    );
    expect(results[0].passed).toBe(true);
  });

  test("exact compare mode requires matching order", async () => {
    const results = await runCode(
      "function pair() { return [1, 0]; }",
      "pair",
      [{ args: [], expected: [0, 1] }],
      "exact"
    );
    expect(results[0].passed).toBe(false);
  });

  test("a syntax error is reported without crashing the process", async () => {
    const results = await runCode("function broken( {{{", "broken", [{ args: [], expected: null }]);
    expect(results[0].passed).toBe(false);
    expect(results[0].error).toMatch(/Failed to run code/);
  });

  test("an infinite loop is killed by the timeout, not left hanging", async () => {
    const start = Date.now();
    const results = await runCode(
      "function loop() { while (true) {} }",
      "loop",
      [{ args: [], expected: null }]
    );
    expect(results[0].passed).toBe(false);
    expect(results[0].error).toMatch(/timed out/i);
    expect(Date.now() - start).toBeLessThan(6000); // well under the 5s hard backstop
  });

  test("submitted code cannot access Node globals like process", async () => {
    const results = await runCode(
      "function check() { return typeof process; }",
      "check",
      [{ args: [], expected: "undefined" }]
    );
    expect(results[0].actualOutput).toBe("undefined");
  });

  test("console.log calls are captured, not written to the server's stdout", async () => {
    const results = await runCode(
      "function withLog(x) { console.log('debug:', x); return x * 2; }",
      "withLog",
      [{ args: [5], expected: 10 }]
    );
    expect(results[0].passed).toBe(true);
    expect(results[0].logs).toEqual(["debug: 5"]);
  });

  test("multiple test cases run independently in one worker", async () => {
    const results = await runCode(
      "function square(x) { return x * x; }",
      "square",
      [
        { args: [2], expected: 4 },
        { args: [3], expected: 9 },
        { args: [4], expected: 15 }, // deliberately wrong
      ]
    );
    expect(results.map((r) => r.passed)).toEqual([true, true, false]);
  });

  test("empty code fails gracefully without spawning a worker", async () => {
    const results = await runCode("", "add", [{ args: [1, 2], expected: 3 }]);
    expect(results[0].passed).toBe(false);
    expect(results[0].error).toMatch(/no code submitted/i);
  });
});

describe("comparison helpers", () => {
  test("deepEqual requires matching array order", () => {
    expect(deepEqual([1, 2], [1, 2])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  test("unorderedDeepEqual matches nested arrays regardless of order", () => {
    expect(unorderedDeepEqual([["a", "b"], ["c"]], [["c"], ["b", "a"]])).toBe(true);
    expect(unorderedDeepEqual([["a", "b"], ["c"]], [["c"], ["x", "y"]])).toBe(false);
  });
});
