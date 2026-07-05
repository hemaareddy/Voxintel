/**
 * codeExecutionWorker.js
 * Runs inside a worker_thread, spawned by codeExecutionService.js. This is
 * the ONLY place candidate-submitted code actually executes, and it runs
 * inside a restricted `vm` context — not at this file's own top level.
 *
 * SECURITY NOTE: this is a best-effort sandbox (worker thread + vm context +
 * execution timeout), appropriate for a trusted, single-user local dev tool.
 * Node's `vm` module is explicitly documented as NOT a hardened security
 * boundary against determined adversarial code. Do not expose this to
 * untrusted multi-tenant traffic without real OS-level isolation (e.g.
 * Docker with dropped capabilities, gVisor, Firecracker).
 */

const { workerData, parentPort } = require("worker_threads");
const vm = require("vm");

const { code, functionName, argsList } = workerData;
const TIMEOUT_MS = 2000;

const safeStringify = (val) => {
  if (typeof val === "string") return val;
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
};

const makeSandbox = (logs) => {
  const sandbox = {
    console: { log: (...args) => logs.push(args.map(safeStringify).join(" ")) },
    Math, JSON, Array, Object, String, Number, Boolean, Date, RegExp, Map, Set,
  };
  vm.createContext(sandbox);
  return sandbox;
};

// Define the candidate's code once, in a fresh sandbox.
const defineLogs = [];
const sandbox = makeSandbox(defineLogs);

try {
  new vm.Script(code, { timeout: TIMEOUT_MS }).runInContext(sandbox, { timeout: TIMEOUT_MS });
} catch (defineErr) {
  parentPort.postMessage(
    argsList.map(() => ({ output: undefined, error: `Failed to run code: ${defineErr.message}`, logs: [] }))
  );
  return;
}

const results = [];

for (const args of argsList) {
  const logs = [];
  sandbox.console = { log: (...a) => logs.push(a.map(safeStringify).join(" ")) };
  sandbox.__args = args;
  sandbox.__result = undefined;

  try {
    new vm.Script(`__result = ${functionName}.apply(null, __args);`, { timeout: TIMEOUT_MS })
      .runInContext(sandbox, { timeout: TIMEOUT_MS });
    results.push({ output: sandbox.__result, error: null, logs });
  } catch (err) {
    results.push({ output: undefined, error: err.message, logs });
  }
}

parentPort.postMessage(results);
