/**
 * pythonExecutor.js
 * Runs a candidate's submitted Python function against test cases by
 * spawning the system `python` interpreter as a child process.
 *
 * SECURITY NOTE: unlike the JavaScript path (worker_thread + vm — see
 * codeExecutionWorker.js), there is NO sandbox here. `python` runs as a
 * normal OS process with full filesystem/network access, same as running
 * `python solution.py` yourself in a terminal. This is only appropriate
 * because the whole coding-round feature is a best-effort tool for a
 * trusted, single local user testing their own code (see CLAUDE.md's
 * code-execution-sandbox note) — do not reuse this pattern for multi-tenant
 * or public-facing code execution without adding real OS-level isolation.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { deepEqual, unorderedDeepEqual } = require("../codeExecutionService");

const TIMEOUT_MS = 5000;
const MAX_CODE_LENGTH = 20000;
const RESULT_MARKER = "###VOXINTEL_RESULTS###";
const PYTHON_BIN = process.env.PYTHON_EXEC_BIN || "python";

const DRIVER = (functionName) => `
import json, os

_here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_here, "testcases.json"), "r", encoding="utf-8") as _f:
    _cases = json.load(_f)

_out = []
for _case in _cases:
    try:
        _result = ${functionName}(*_case["args"])
        _out.append({"ok": True, "result": _result})
    except Exception as _e:
        _out.append({"ok": False, "error": str(_e)})

print("${RESULT_MARKER}")
print(json.dumps(_out))
`;

const failAll = (testCases, error) =>
  testCases.map((tc) => ({ passed: false, actualOutput: undefined, expectedOutput: tc.expected, error, logs: [] }));

const runCode = (code, functionName, testCases, compareMode = "exact") => {
  if (!code || code.length > MAX_CODE_LENGTH) {
    return Promise.resolve(
      failAll(testCases, !code ? "No code submitted" : `Code exceeds max length of ${MAX_CODE_LENGTH} characters`)
    );
  }

  return new Promise((resolve) => {
    const dir = path.join(os.tmpdir(), `voxintel-py-${crypto.randomBytes(8).toString("hex")}`);
    const scriptPath = path.join(dir, "solution.py");
    const casesPath = path.join(dir, "testcases.json");
    const cleanup = () => fs.rm(dir, { recursive: true, force: true }, () => {});

    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(scriptPath, `${code}\n\n${DRIVER(functionName)}`);
      fs.writeFileSync(casesPath, JSON.stringify(testCases.map((tc) => ({ args: tc.args }))));
    } catch (writeErr) {
      cleanup();
      return resolve(failAll(testCases, `Failed to prepare execution: ${writeErr.message}`));
    }

    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(PYTHON_BIN, [scriptPath], { cwd: dir });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(failAll(testCases, "Execution timed out"));
    }, TIMEOUT_MS);

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("error", (err) => {
      const notFound = err.code === "ENOENT";
      finish(failAll(testCases, notFound
        ? "Python interpreter not found on this machine (expected `python` on PATH)"
        : err.message));
    });

    child.on("close", () => {
      const markerIdx = stdout.indexOf(RESULT_MARKER);
      if (markerIdx === -1) {
        const lastLine = stderr.trim().split("\n").filter(Boolean).pop();
        return finish(failAll(testCases, `Failed to run code: ${lastLine || "no output produced"}`));
      }

      let parsed;
      try {
        parsed = JSON.parse(stdout.slice(markerIdx + RESULT_MARKER.length).trim());
      } catch (parseErr) {
        return finish(failAll(testCases, `Failed to parse execution output: ${parseErr.message}`));
      }

      finish(
        parsed.map((r, i) => {
          const expected = testCases[i].expected;
          if (!r.ok) {
            return { passed: false, actualOutput: undefined, expectedOutput: expected, error: r.error, logs: [] };
          }
          const passed = compareMode === "unordered" ? unorderedDeepEqual(r.result, expected) : deepEqual(r.result, expected);
          return { passed, actualOutput: r.result, expectedOutput: expected, error: null, logs: [] };
        })
      );
    });
  });
};

module.exports = { runCode };
