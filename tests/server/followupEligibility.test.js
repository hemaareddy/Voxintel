/**
 * Tests for:
 * - sessionController's follow-up eligibility selection (resume-based
 *   questions are eligible; a minimum of 3 is guaranteed even with no resume)
 * - completionController folding answered follow-ups into the session's
 *   score aggregation as additional graded items
 */

const InterviewSession = require("../../server/models/InterviewSession");
const Question = require("../../server/models/Question");
const User = require("../../server/models/User");
const { startSession } = require("../../server/controllers/interview/sessionController");
const { completeSession } = require("../../server/controllers/interview/completionController");

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("follow-up eligibility on session start", () => {
  test("guarantees at least 3 eligible questions when none are resume-based", async () => {
    const datasetQuestions = Array.from({ length: 6 }, (_, i) => ({
      _id: `q${i}`,
      question: `Question ${i}`,
      difficulty: "medium",
      category: "Backend Development",
      ideal_answer: "x",
      keywords: [],
      evaluation_guidelines: "",
      follow_up_questions: [],
    }));
    jest.spyOn(Question, "find").mockReturnValue({
      limit: jest.fn().mockResolvedValue(datasetQuestions),
    });

    let capturedAnswers;
    jest.spyOn(InterviewSession, "create").mockImplementation(async (data) => {
      capturedAnswers = data.answers;
      return { _id: "session1", ...data };
    });

    const req = {
      body: { role: "Backend Developer", interviewType: "Backend Interview", questionCount: 6 },
      user: { _id: "user1" },
    };

    await startSession(req, mockRes());

    expect(capturedAnswers.every((a) => a.source === "dataset")).toBe(true);
    const eligibleCount = capturedAnswers.filter((a) => a.followUpEligible).length;
    expect(eligibleCount).toBeGreaterThanOrEqual(3);
  });
});

describe("session completion aggregation includes answered follow-ups", () => {
  test("folds an answered follow-up's scores into the session average", async () => {
    const session = {
      _id: "session1",
      user: "user1",
      answers: [
        {
          userAnswer: "a",
          category: "Frontend Development",
          scores: { semantic: 80, overall: 80 },
          plagiarism: { isOriginal: true },
          followUp: {
            userAnswer: "b",
            scores: { semantic: 40, overall: 40 },
            plagiarism: { isOriginal: true },
          },
        },
      ],
      save: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);
    jest.spyOn(InterviewSession, "find").mockResolvedValue([
      { answers: session.answers, summary: { averageOverallScore: 60 } },
    ]);
    jest.spyOn(User, "findByIdAndUpdate").mockResolvedValue(true);

    const req = { body: { sessionId: "session1" }, user: { _id: "user1" } };
    await completeSession(req, mockRes());

    // average of the primary answer (80) and its follow-up (40) = 60
    expect(session.summary.averageOverallScore).toBe(60);
  });

  test("an unanswered follow-up (question generated but not yet answered) is excluded", async () => {
    const session = {
      _id: "session1",
      user: "user1",
      answers: [
        {
          userAnswer: "a",
          category: "Frontend Development",
          scores: { semantic: 80, overall: 80 },
          plagiarism: { isOriginal: true },
          followUp: { question: "pending?", userAnswer: "" }, // generated, not yet answered
        },
      ],
      save: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);
    jest.spyOn(InterviewSession, "find").mockResolvedValue([
      { answers: session.answers, summary: { averageOverallScore: 80 } },
    ]);
    jest.spyOn(User, "findByIdAndUpdate").mockResolvedValue(true);

    const req = { body: { sessionId: "session1" }, user: { _id: "user1" } };
    await completeSession(req, mockRes());

    expect(session.summary.averageOverallScore).toBe(80);
  });
});
