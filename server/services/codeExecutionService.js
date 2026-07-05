/**
 * codeExecutionService.js
 * Runs a candidate's submitted JavaScript function against a set of test
 * cases, in an isolated worker thread (see codeExecutionWorker.js), and
 * grades each result.
 *
 * SECURITY NOTE: see codeExecutionWorker.js — this is a best-effort sandbox
 * for a trusted, single-user local dev tool, not a hardened multi-tenant
 * execution service.
 */

const path = require("path");
const { Worker } = require("worker_threads");

const WORKER_PATH = path.join(__dirname, "codeExecutionWorker.js");
const HARD_TIMEOUT_MS = 5000; // backstop in case the in-vm timeout doesn't fire
const MAX_CODE_LENGTH = 20000;

// Deep equality — order matters.
const deepEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  if (a && b && typeof a === "object") {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return aKeys.length === bKeys.length && aKeys.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
};

// Deep equality, but arrays (at any nesting level) are treated as unordered
// multisets — for problems with more than one valid ordering.
const unorderedDeepEqual = (a, b) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const remaining = [...b];
    for (const itemA of a) {
      const idx = remaining.findIndex((itemB) => unorderedDeepEqual(itemA, itemB));
      if (idx === -1) return false;
      remaining.splice(idx, 1);
    }
    return true;
  }
  return deepEqual(a, b);
};

// Runs `functionName` from `code` against every test case in one sandboxed
// worker thread. Resolves with one graded result per test case:
// { passed, actualOutput, expectedOutput, error, logs }
const runCode = (code, functionName, testCases, compareMode = "exact") => {
  if (!code || code.length > MAX_CODE_LENGTH) {
    return Promise.resolve(
      testCases.map((tc) => ({
        passed: false,
        actualOutput: undefined,
        expectedOutput: tc.expected,
        error: !code ? "No code submitted" : `Code exceeds max length of ${MAX_CODE_LENGTH} characters`,
        logs: [],
      }))
    );
  }

  return new Promise((resolve) => {
    const worker = new Worker(WORKER_PATH, {
      workerData: { code, functionName, argsList: testCases.map((tc) => tc.args) },
    });

    const finish = (rawResults) => {
      clearTimeout(timer);
      worker.removeAllListeners();
      worker.terminate();
      resolve(
        rawResults.map((r, i) => {
          const expected = testCases[i].expected;
          const passed = !r.error && (compareMode === "unordered" ? unorderedDeepEqual(r.output, expected) : deepEqual(r.output, expected));
          return { passed, actualOutput: r.output, expectedOutput: expected, error: r.error, logs: r.logs || [] };
        })
      );
    };

    const timer = setTimeout(() => {
      worker.terminate();
      resolve(
        testCases.map((tc) => ({
          passed: false,
          actualOutput: undefined,
          expectedOutput: tc.expected,
          error: "Execution timed out",
          logs: [],
        }))
      );
    }, HARD_TIMEOUT_MS);

    worker.once("message", finish);

    worker.once("error", (err) => {
      clearTimeout(timer);
      worker.removeAllListeners();
      resolve(
        testCases.map((tc) => ({
          passed: false,
          actualOutput: undefined,
          expectedOutput: tc.expected,
          error: err.message,
          logs: [],
        }))
      );
    });
  });
};

module.exports = { runCode, deepEqual, unorderedDeepEqual };
