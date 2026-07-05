/**
 * Tests the coding-round UI: a coding question should show the code editor
 * (not the prose textarea/voice controls) pre-filled with starter code, and
 * the feedback panel should render per-test-case pass/fail after submission.
 *
 * @monaco-editor/react is mocked with a plain textarea stand-in — Monaco
 * itself needs browser APIs (workers, canvas) jsdom doesn't provide, and the
 * real editor's behavior isn't what these tests are checking.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import InterviewPage from "./InterviewPage";
import { interviewAPI } from "../utils/api";

jest.mock("../utils/api", () => ({
  interviewAPI: {
    submitAnswer: jest.fn(),
    complete: jest.fn(),
  },
}));

jest.mock("@monaco-editor/react", () => ({
  __esModule: true,
  default: ({ value, onChange }) => (
    <textarea
      data-testid="mock-monaco-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const session = {
  sessionId: "session1",
  config: { role: "Backend Developer", company: "General", difficulty: "easy" },
  questions: [
    {
      index: 0,
      question: "Write a function `add(a, b)` that returns the sum of two numbers.",
      title: "Add Two Numbers",
      category: "Data Structures & Algorithms",
      difficulty: "easy",
      source: "dataset",
      type: "coding",
      functionName: "add",
      starterCode: {
        javascript: "function add(a, b) {\n  \n}",
        python: "def add(a, b):\n    pass",
        java: "class Solution {\n    public int add(int a, int b) {\n        \n    }\n}",
      },
      testCases: [{ args: [2, 3], expected: 5 }],
      expectedConcepts: ["arithmetic"],
    },
    {
      index: 1,
      question: "Reverse a string.",
      category: "Data Structures & Algorithms",
      difficulty: "easy",
      source: "dataset",
      type: "coding",
      functionName: "reverseString",
      starterCode: { javascript: "function reverseString(str) {}" },
      testCases: [],
      expectedConcepts: [],
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/interview", state: { session } }]}>
      <InterviewPage />
    </MemoryRouter>
  );
}

// The interview is gated behind a "Ready to begin?" screen (entering
// fullscreen needs a user gesture) — every test must click through it first.
async function beginInterview() {
  fireEvent.click(screen.getByRole("button", { name: /enter fullscreen.*start interview/i }));
  await screen.findByText(/question 1 of/i);
}

afterEach(() => {
  jest.clearAllMocks();
});

test("shows the code editor pre-filled with starter code, not the prose textarea", async () => {
  renderPage();
  await beginInterview();

  expect(screen.getByTestId("mock-monaco-editor")).toHaveValue("function add(a, b) {\n  \n}");
  expect(screen.queryByPlaceholderText(/type your answer here/i)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /run & submit code/i })).toBeInTheDocument();
});

test("shows example test cases and expected concepts for the coding question", async () => {
  renderPage();
  await beginInterview();

  expect(screen.getByText(/add\(2, 3\)/)).toBeInTheDocument();
  expect(screen.getByText("arithmetic")).toBeInTheDocument();
});

test("submitting code shows per-test-case pass/fail results", async () => {
  interviewAPI.submitAnswer.mockResolvedValueOnce({
    data: {
      scores: { overall: 100 },
      testResults: [{ passed: true, actualOutput: 5, expectedOutput: 5, error: null }],
      hiddenTestSummary: { passed: 2, total: 2 },
      feedback: "All 3 test cases passed! Great work.",
      followUpQuestion: null,
    },
  });

  renderPage();
  await beginInterview();

  fireEvent.change(screen.getByTestId("mock-monaco-editor"), {
    target: { value: "function add(a, b) { return a + b; }" },
  });
  fireEvent.click(screen.getByRole("button", { name: /run & submit code/i }));

  expect(await screen.findByText(/test case 1/i)).toBeInTheDocument();
  expect(screen.getByText(/hidden tests: 2\/2 passed/i)).toBeInTheDocument();
  expect(interviewAPI.submitAnswer).toHaveBeenCalledWith(
    expect.objectContaining({ userAnswer: "function add(a, b) { return a + b; }", language: "javascript" })
  );
});

test("switching the language selector swaps starter code and is sent with the submission", async () => {
  interviewAPI.submitAnswer.mockResolvedValueOnce({
    data: { scores: { overall: 100 }, testResults: [], feedback: "", followUpQuestion: null },
  });

  renderPage();
  await beginInterview();

  fireEvent.change(screen.getByLabelText(/programming language/i), { target: { value: "python" } });
  expect(screen.getByTestId("mock-monaco-editor")).toHaveValue("def add(a, b):\n    pass");

  fireEvent.click(screen.getByRole("button", { name: /run & submit code/i }));

  expect(interviewAPI.submitAnswer).toHaveBeenCalledWith(
    expect.objectContaining({ userAnswer: "def add(a, b):\n    pass", language: "python" })
  );
});

test("a language not offered for a question doesn't appear in the selector", async () => {
  renderPage();
  await beginInterview();
  fireEvent.click(screen.getByRole("button", { name: /skip/i }));
  await screen.findByText(/question 2 of/i);

  expect(screen.getByLabelText(/programming language/i)).toHaveDisplayValue("JavaScript");
  expect(screen.queryByText("Python")).not.toBeInTheDocument();
});
