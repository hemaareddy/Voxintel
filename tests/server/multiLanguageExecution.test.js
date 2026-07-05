/**
 * Tests for the Python and Java coding-round executors. Like
 * codeExecutionService.test.js, these run real code through the real
 * interpreter/compiler (not mocked) since the point is "does the submitted
 * code actually run and get graded correctly" for each language VoxIntel
 * offers. Requires `python` and `javac`/`java` to be on PATH — if either
 * isn't installed, its describe block will fail loudly rather than silently
 * passing, which is the right failure mode for a grading feature.
 */

const pythonExecutor = require("../../server/services/execution/pythonExecutor");
const javaExecutor = require("../../server/services/execution/javaExecutor");
const dispatcher = require("../../server/services/execution");

jest.setTimeout(20000);

describe("pythonExecutor.runCode", () => {
  test("a correct solution passes", async () => {
    const results = await pythonExecutor.runCode("def add(a, b):\n    return a + b", "add", [{ args: [2, 3], expected: 5 }]);
    expect(results).toEqual([expect.objectContaining({ passed: true, actualOutput: 5 })]);
  });

  test("an incorrect solution fails without throwing", async () => {
    const results = await pythonExecutor.runCode("def add(a, b):\n    return a - b", "add", [{ args: [2, 3], expected: 5 }]);
    expect(results[0].passed).toBe(false);
    expect(results[0].actualOutput).toBe(-1);
  });

  test("a runtime exception is reported per test case, not crashing the run", async () => {
    const results = await pythonExecutor.runCode(
      "def divide(a, b):\n    return a / b",
      "divide",
      [{ args: [10, 2], expected: 5 }, { args: [10, 0], expected: null }]
    );
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(false);
    expect(results[1].error).toMatch(/division by zero/i);
  });

  test("a syntax error is reported without crashing the process", async () => {
    const results = await pythonExecutor.runCode("def broken(:\n    pass", "broken", [{ args: [], expected: null }]);
    expect(results[0].passed).toBe(false);
    expect(results[0].error).toMatch(/failed to run code/i);
  });

  test("unordered compare mode ignores array order", async () => {
    const results = await pythonExecutor.runCode(
      "def pair():\n    return [1, 0]",
      "pair",
      [{ args: [], expected: [0, 1] }],
      "unordered"
    );
    expect(results[0].passed).toBe(true);
  });

  test("nested dict/list values round-trip correctly (deepClone-style)", async () => {
    const results = await pythonExecutor.runCode(
      "def deepClone(value):\n    import copy\n    return copy.deepcopy(value)",
      "deepClone",
      [{ args: [{ a: 1, b: { c: [1, 2, 3] } }], expected: { a: 1, b: { c: [1, 2, 3] } } }]
    );
    expect(results[0].passed).toBe(true);
  });
});

describe("javaExecutor.runCode", () => {
  test("a correct solution passes (int[] args/return)", async () => {
    const code = `class Solution {
      public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++) {
          for (int j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] == target) return new int[]{i, j};
          }
        }
        return new int[]{};
      }
    }`;
    const results = await javaExecutor.runCode(code, "twoSum", [{ args: [[2, 7, 11, 15], 9], expected: [0, 1] }]);
    expect(results[0].passed).toBe(true);
  });

  test("an incorrect solution fails without throwing", async () => {
    const code = `class Solution {
      public boolean isPalindrome(String str) {
        return false;
      }
    }`;
    const results = await javaExecutor.runCode(code, "isPalindrome", [{ args: ["racecar"], expected: true }]);
    expect(results[0].passed).toBe(false);
    expect(results[0].actualOutput).toBe(false);
  });

  test("a runtime exception is reported per test case", async () => {
    const code = `class Solution {
      public int findMax(int[] nums) {
        if (nums.length == 0) throw new RuntimeException("empty array");
        int max = nums[0];
        for (int n : nums) if (n > max) max = n;
        return max;
      }
    }`;
    const results = await javaExecutor.runCode(code, "findMax", [
      { args: [[3, 1, 4]], expected: 4 },
      { args: [[]], expected: null },
    ]);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(false);
    expect(results[1].error).toMatch(/empty array/);
  });

  test("a compile error is reported without crashing, failing every test case", async () => {
    const results = await javaExecutor.runCode("class Solution { this is not java }", "add", [{ args: [1, 2], expected: 3 }]);
    expect(results[0].passed).toBe(false);
    expect(results[0].error).toMatch(/compilation error/i);
  });

  test("generic Object args/return handle arbitrary nested values (deepClone-style)", async () => {
    const code = `class Solution {
      public Object deepClone(Object value) {
        if (value instanceof java.util.Map) {
          java.util.Map<String, Object> copy = new java.util.LinkedHashMap<String, Object>();
          for (java.util.Map.Entry<?, ?> e : ((java.util.Map<?, ?>) value).entrySet()) {
            copy.put(String.valueOf(e.getKey()), deepClone(e.getValue()));
          }
          return copy;
        }
        if (value instanceof java.util.List) {
          java.util.List<Object> copy = new java.util.ArrayList<Object>();
          for (Object item : (java.util.List<?>) value) copy.add(deepClone(item));
          return copy;
        }
        return value;
      }
    }`;
    const results = await javaExecutor.runCode(code, "deepClone", [
      { args: [{ a: 1, b: { c: 2 } }], expected: { a: 1, b: { c: 2 } } },
      { args: [null], expected: null },
    ]);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(true);
  });
});

describe("execution dispatcher", () => {
  test("routes to the right executor by language, defaulting to javascript", async () => {
    const jsResults = await dispatcher.runCode("javascript", "function add(a,b){return a+b;}", "add", [{ args: [1, 2], expected: 3 }]);
    expect(jsResults[0].passed).toBe(true);

    const pyResults = await dispatcher.runCode("python", "def add(a, b):\n    return a + b", "add", [{ args: [1, 2], expected: 3 }]);
    expect(pyResults[0].passed).toBe(true);

    const unknownLangResults = await dispatcher.runCode("cobol", "function add(a,b){return a+b;}", "add", [{ args: [1, 2], expected: 3 }]);
    expect(unknownLangResults[0].passed).toBe(true); // falls back to javascript
  });

  test("exposes the languages VoxIntel actually offers", () => {
    expect(dispatcher.SUPPORTED_LANGUAGES).toEqual(expect.arrayContaining(["javascript", "python", "java"]));
    expect(dispatcher.SUPPORTED_LANGUAGES).not.toContain("c");
  });
});
