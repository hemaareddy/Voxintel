/**
 * execution/index.js
 * Dispatches coding-round grading to the executor for the language the
 * candidate picked. Every executor shares the same contract:
 *   runCode(code, functionName, testCases, compareMode) =>
 *     Promise<Array<{ passed, actualOutput, expectedOutput, error, logs }>>
 * so answerController.js can grade any supported language identically and
 * "correct in any language" just means "any executor reports all tests passed".
 *
 * `c` is intentionally unimplemented — this dev machine has no C compiler
 * (gcc/MinGW) to build and verify a driver against, and shipping untested
 * compile/execute code for a grading feature is worse than not having it.
 * The dispatch point is here if a cExecutor.js is added later.
 */

const javascriptExecutor = require("../codeExecutionService");
const pythonExecutor = require("./pythonExecutor");
const javaExecutor = require("./javaExecutor");

const EXECUTORS = {
  javascript: javascriptExecutor,
  python: pythonExecutor,
  java: javaExecutor,
};

const SUPPORTED_LANGUAGES = Object.keys(EXECUTORS);

const runCode = (language, code, functionName, testCases, compareMode = "exact") => {
  const executor = EXECUTORS[language] || EXECUTORS.javascript;
  return executor.runCode(code, functionName, testCases, compareMode);
};

module.exports = { runCode, SUPPORTED_LANGUAGES };
