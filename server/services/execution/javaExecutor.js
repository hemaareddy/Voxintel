/**
 * javaExecutor.js
 * Compiles and runs a candidate's submitted Java `Solution` class against
 * test cases, by spawning `javac`/`java` as child processes.
 *
 * The candidate submits only a `class Solution { ... }` body (see starter
 * code in coding_questions.py) with a natural, concretely-typed method
 * signature (e.g. `public int[] twoSum(int[] nums, int target)`). It's
 * appended to a fixed driver (templates/JavaDriver.template.java) that
 * finds the method via reflection, coerces each JSON test-case argument to
 * whatever type that method actually declares, and prints one JSON result
 * per test case — so this driver never needs to know a question's argument
 * shapes ahead of time.
 *
 * SECURITY NOTE: same caveat as pythonExecutor.js — no sandbox, `java` runs
 * as a normal OS process. Best-effort tool for a trusted, single local user;
 * see CLAUDE.md's code-execution-sandbox note.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { deepEqual, unorderedDeepEqual } = require("../codeExecutionService");

const COMPILE_TIMEOUT_MS = 10000;
const RUN_TIMEOUT_MS = 5000;
const MAX_CODE_LENGTH = 20000;
const RESULT_MARKER = "###VOXINTEL_JAVA_RESULTS###";
const JAVAC_BIN = process.env.JAVAC_EXEC_BIN || "javac";
const JAVA_BIN = process.env.JAVA_EXEC_BIN || "java";

const TEMPLATE = fs.readFileSync(path.join(__dirname, "templates", "JavaDriver.template.java"), "utf8");

const failAll = (testCases, error) =>
  testCases.map((tc) => ({ passed: false, actualOutput: undefined, expectedOutput: tc.expected, error, logs: [] }));

// Runs `cmd args` in `cwd`, resolving { code, stdout, stderr, timedOut, notFound }.
const run = (cmd, args, cwd, timeoutMs) =>
  new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(cmd, args, { cwd });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ code: null, stdout, stderr, timedOut: true, notFound: false });
    }, timeoutMs);

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (err) => finish({ code: null, stdout, stderr, timedOut: false, notFound: err.code === "ENOENT" }));
    child.on("close", (code) => finish({ code, stdout, stderr, timedOut: false, notFound: false }));
  });

const runCode = async (code, functionName, testCases, compareMode = "exact") => {
  if (!code || code.length > MAX_CODE_LENGTH) {
    return failAll(testCases, !code ? "No code submitted" : `Code exceeds max length of ${MAX_CODE_LENGTH} characters`);
  }

  const dir = path.join(os.tmpdir(), `voxintel-java-${crypto.randomBytes(8).toString("hex")}`);
  const cleanup = () => fs.rm(dir, { recursive: true, force: true }, () => {});

  try {
    fs.mkdirSync(dir, { recursive: true });
    const driverSource = TEMPLATE
      .replace(/__FUNCTION_NAME__/g, functionName)
      .replace(/__RESULT_MARKER__/g, RESULT_MARKER);
    fs.writeFileSync(path.join(dir, "Main.java"), `${driverSource}\n\n${code}\n`);
    fs.writeFileSync(path.join(dir, "testcases.json"), JSON.stringify(testCases.map((tc) => ({ args: tc.args }))));
  } catch (writeErr) {
    cleanup();
    return failAll(testCases, `Failed to prepare execution: ${writeErr.message}`);
  }

  const compileResult = await run(JAVAC_BIN, ["Main.java"], dir, COMPILE_TIMEOUT_MS);

  if (compileResult.notFound) {
    cleanup();
    return failAll(testCases, "Java compiler not found on this machine (expected `javac` on PATH — install a JDK)");
  }
  if (compileResult.timedOut) {
    cleanup();
    return failAll(testCases, "Compilation timed out");
  }
  if (compileResult.code !== 0) {
    cleanup();
    // javac's own error text already points at the candidate's code (line numbers
    // in the "// candidate code" region below the fixed driver).
    const message = compileResult.stderr.trim() || "Compilation failed";
    return failAll(testCases, `Compilation error: ${message}`);
  }

  const runResult = await run(JAVA_BIN, ["-cp", ".", "Main"], dir, RUN_TIMEOUT_MS);
  cleanup();

  if (runResult.notFound) {
    return failAll(testCases, "Java runtime not found on this machine (expected `java` on PATH)");
  }
  if (runResult.timedOut) {
    return failAll(testCases, "Execution timed out");
  }

  const markerIdx = runResult.stdout.indexOf(RESULT_MARKER);
  if (markerIdx === -1) {
    const lastLine = runResult.stderr.trim().split("\n").filter(Boolean).pop();
    return failAll(testCases, `Failed to run code: ${lastLine || "no output produced"}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(runResult.stdout.slice(markerIdx + RESULT_MARKER.length).trim());
  } catch (parseErr) {
    return failAll(testCases, `Failed to parse execution output: ${parseErr.message}`);
  }

  return parsed.map((r, i) => {
    const expected = testCases[i].expected;
    if (!r.ok) {
      return { passed: false, actualOutput: undefined, expectedOutput: expected, error: r.error, logs: [] };
    }
    const passed = compareMode === "unordered" ? unorderedDeepEqual(r.result, expected) : deepEqual(r.result, expected);
    return { passed, actualOutput: r.result, expectedOutput: expected, error: null, logs: [] };
  });
};

module.exports = { runCode };
