/**
 * Tests for grading coding-round submissions in answerController.js.
 * Uses the real codeExecutionService (not mocked) since the whole point of
 * this path is "does the submitted code actually work" — a mock would test
 * nothing meaningful here. pythonNlpClient IS mocked (a separate module) so
 * follow-up generation is deterministic rather than depending on a live
 * Python service being reachable from the test environment.
 */

const InterviewSession = require("../../server/models/InterviewSession");
const pythonNlpClient = require("../../server/services/pythonNlpClient");
const { submitAnswer } = require("../../server/controllers/interview/answerController");

jest.mock("../../server/services/pythonNlpClient");
jest.setTimeout(15000);

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function codingSession() {
  return {
    _id: "session1",
    user: "user1",
    status: "in_progress",
    answers: [
      {
        question: "Write a function that adds two numbers.",
        type: "coding",
        functionName: "add",
        starterCode: "function add(a, b) {\n  \n}",
        compareMode: "exact",
        testCases: [{ args: [2, 3], expected: 5 }],
        hiddenTestCases: [{ args: [10, -4], expected: 6 }],
        followUpEligible: false,
        hadFollowUp: false,
      },
    ],
    save: jest.fn().mockResolvedValue(true),
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("submitAnswer for coding questions", () => {
  test("a fully correct solution passes all public and hidden test cases", async () => {
    const session = codingSession();
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);

    const req = {
      body: { sessionId: "session1", questionIndex: 0, userAnswer: "function add(a, b) { return a + b; }" },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.scores.overall).toBe(100);
    expect(payload.testResults).toEqual([expect.objectContaining({ passed: true, actualOutput: 5 })]);
    expect(payload.hiddenTestSummary).toEqual({ passed: 1, total: 1 });
    expect(payload.followUpQuestion).toBeNull();
    expect(session.save).toHaveBeenCalled();
  });

  test("hidden test case details are never sent to the client", async () => {
    const session = codingSession();
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);

    // Passes the public case (2+3=5) but fails the hidden one (10 + -4 = 6, this returns 14)
    const req = {
      body: { sessionId: "session1", questionIndex: 0, userAnswer: "function add(a, b) { return a - b === -1 ? 5 : Math.abs(a)+Math.abs(b); }" },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    const payload = res.json.mock.calls[0][0];
    // Only the public test case appears in testResults — no hidden args/expected leaked
    expect(payload.testResults).toHaveLength(1);
    expect(payload.hiddenTestSummary.total).toBe(1);
    expect(JSON.stringify(payload)).not.toContain("-4"); // hidden test's input never serialized to the client
  });

  test("an incorrect solution is scored proportionally to tests passed", async () => {
    const session = codingSession();
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);

    const req = {
      body: { sessionId: "session1", questionIndex: 0, userAnswer: "function add(a, b) { return 999; }" },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.scores.overall).toBe(0);
    expect(payload.testResults[0].passed).toBe(false);
    expect(payload.feedback).toMatch(/expected 5 but got 999/);
  });

  test("a Coding Round question (followUpEligible: false) never generates a follow-up", async () => {
    const session = codingSession();
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);

    const req = {
      body: { sessionId: "session1", questionIndex: 0, userAnswer: "function add(a, b) { return a + b; }" },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.followUpQuestion).toBeNull();
    expect(payload.scores.overall).toBe(100);
  });

  test("a Python solution is graded correctly when language: 'python' is submitted", async () => {
    const session = codingSession();
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);

    const req = {
      body: {
        sessionId: "session1",
        questionIndex: 0,
        userAnswer: "def add(a, b):\n    return a + b",
        language: "python",
      },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.scores.overall).toBe(100);
    expect(session.answers[0].language).toBe("python");
  });

  test("an unrecognized language falls back to javascript grading", async () => {
    const session = codingSession();
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);

    const req = {
      body: {
        sessionId: "session1",
        questionIndex: 0,
        userAnswer: "function add(a, b) { return a + b; }",
        language: "cobol",
      },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.scores.overall).toBe(100);
    expect(session.answers[0].language).toBe("javascript");
  });

  test("submitting isFollowUp for a question with no pending follow-up is rejected", async () => {
    const session = codingSession();
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);

    const req = {
      body: {
        sessionId: "session1",
        questionIndex: 0,
        userAnswer: "function add(a, b) { return a + b; }",
        isFollowUp: true,
      },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await expect(submitAnswer(req, res)).rejects.toThrow("No follow-up question is pending");
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("submitAnswer for coding questions — Coding Interview (followUpEligible: true)", () => {
  function interviewCodingSession({ expectedConcepts = ["hash map"] } = {}) {
    return {
      _id: "session1",
      user: "user1",
      status: "in_progress",
      answers: [
        {
          question: "Write a function that adds two numbers.",
          type: "coding",
          functionName: "add",
          starterCode: "function add(a, b) {\n  \n}",
          compareMode: "exact",
          testCases: [{ args: [2, 3], expected: 5 }],
          hiddenTestCases: [{ args: [10, -4], expected: 6 }],
          expectedConcepts,
          followUpEligible: true,
          hadFollowUp: false,
        },
      ],
      save: jest.fn().mockResolvedValue(true),
    };
  }

  beforeEach(() => {
    pythonNlpClient.generateCodeFollowup.mockImplementation(({ passedCount, totalCount, firstPublicFailure }) => {
      if (passedCount === totalCount) {
        return Promise.resolve({ question: "What's the time complexity?", based_on: "correct:generic" });
      }
      return Promise.resolve({
        question: `Your solution didn't handle ${JSON.stringify(firstPublicFailure?.args)} correctly. What's missing?`,
        based_on: "failed:public",
      });
    });
    // No live Python service in tests — fall back to keyword-only scoring,
    // same as production does when the Python service is unreachable.
    pythonNlpClient.evaluateAnswer.mockRejectedValue(new Error("Python service not running in tests"));
  });

  test("a correct solution gets an adaptive follow-up question", async () => {
    const session = interviewCodingSession();
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);

    const req = {
      body: { sessionId: "session1", questionIndex: 0, userAnswer: "function add(a, b) { return a + b; }" },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.followUpQuestion).toBeTruthy();
    expect(session.answers[0].hadFollowUp).toBe(true);
    expect(session.answers[0].followUp.question).toBe(payload.followUpQuestion);
  });

  test("a failing solution's follow-up references the failing public test case, not the hidden one", async () => {
    const session = interviewCodingSession();
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);

    // Fails the public case (2+3 should be 5, this always returns 999)
    const req = {
      body: { sessionId: "session1", questionIndex: 0, userAnswer: "function add(a, b) { return 999; }" },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.followUpQuestion).toBeTruthy();
    expect(payload.followUpQuestion).not.toContain("-4"); // hidden test input never leaks into the follow-up
  });

  test("submitting the follow-up answer evaluates it against expectedConcepts as keywords", async () => {
    const session = interviewCodingSession({ expectedConcepts: ["addition", "arithmetic"] });
    session.answers[0].hadFollowUp = true;
    session.answers[0].followUp = { question: "What's the time complexity?", basedOn: "correct:generic" };
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);

    const req = {
      body: {
        sessionId: "session1",
        questionIndex: 0,
        userAnswer: "This uses simple addition and arithmetic, so it's O(1) constant time.",
        isFollowUp: true,
      },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    const payload = res.json.mock.calls[0][0];
    // Both "addition" and "arithmetic" appear in the answer → full keyword coverage
    expect(payload.scores.keyword).toBe(100);
    expect(session.answers[0].followUp.userAnswer).toBe(req.body.userAnswer);
  });

  test("a follow-up is only generated once per question", async () => {
    const session = interviewCodingSession();
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);

    const req = {
      body: { sessionId: "session1", questionIndex: 0, userAnswer: "function add(a, b) { return a + b; }" },
      user: { _id: "user1" },
    };

    await submitAnswer(req, mockRes());
    const firstFollowUp = session.answers[0].followUp.question;

    // Re-submitting the primary answer shouldn't regenerate/overwrite the follow-up
    const res2 = mockRes();
    await submitAnswer(req, res2);
    const payload2 = res2.json.mock.calls[0][0];

    expect(payload2.followUpQuestion).toBeNull();
    expect(session.answers[0].followUp.question).toBe(firstFollowUp);
  });
});
