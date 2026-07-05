/**
 * Characterization tests for the interview controllers — pin down
 * request/response behavior for session start, answer submission, and
 * completion, split from the former monolithic interviewController.js
 * into controllers/interview/{sessionController,answerController,completionController}.js.
 *
 * Mongoose models and axios are stubbed — no live MongoDB or Python
 * service is required to run these tests.
 */

const axios = require("axios");
const InterviewSession = require("../../server/models/InterviewSession");
const Question = require("../../server/models/Question");
const User = require("../../server/models/User");
const { startSession } = require("../../server/controllers/interview/sessionController");
const { submitAnswer } = require("../../server/controllers/interview/answerController");
const { completeSession } = require("../../server/controllers/interview/completionController");

jest.mock("axios");

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("startSession", () => {
  test("without a resume, returns dataset-only questions with no candidate intelligence", async () => {
    const datasetQuestions = Array.from({ length: 6 }, (_, i) => ({
      _id: `q${i}`,
      question: `Question ${i}`,
      difficulty: "medium",
      category: "Backend Development",
      ideal_answer: "ideal",
      keywords: ["k1"],
      evaluation_guidelines: "",
      follow_up_questions: [],
    }));

    jest.spyOn(Question, "find").mockReturnValue({
      limit: jest.fn().mockResolvedValue(datasetQuestions),
    });

    jest.spyOn(InterviewSession, "create").mockImplementation(async (data) => ({
      _id: "session1",
      ...data,
    }));

    const req = {
      body: {
        role: "Backend Developer",
        interviewType: "Backend Interview",
        questionCount: 3,
      },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await startSession(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.sessionId).toBe("session1");
    expect(payload.questions).toHaveLength(3);
    expect(payload.candidateIntelligence).toBeNull();
    expect(payload.questionSourceDistribution).toEqual({ resume: 0, dataset: 3 });
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe("submitAnswer", () => {
  const baseSession = () => ({
    _id: "session1",
    user: "user1",
    status: "in_progress",
    answers: [
      {
        questionId: "q0",
        question: "Explain closures.",
        category: "Frontend Development",
        userAnswer: "",
        scores: {},
        confidence: {},
        plagiarism: {},
        feedback: "",
      },
    ],
    save: jest.fn().mockResolvedValue(true),
  });

  test("uses the Python evaluation when the service responds", async () => {
    const session = baseSession();
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);
    jest.spyOn(Question, "findById").mockResolvedValue({
      ideal_answer: "A closure is a function bundled with its lexical scope.",
      keywords: ["closure", "scope"],
    });
    axios.post.mockResolvedValue({
      data: {
        semantic_score: 90,
        keyword_score: 80,
        completeness_score: 70,
        overall_score: 82,
        confidence: { score: 75 },
        plagiarism: { score: 2, isOriginal: true },
        feedback: "Great answer.",
      },
    });

    const req = {
      body: { sessionId: "session1", questionIndex: 0, userAnswer: "A closure keeps scope." },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: { semantic: 90, keyword: 80, completeness: 70, overall: 82 },
        feedback: "Great answer.",
      })
    );
    expect(session.save).toHaveBeenCalled();
  });

  test("falls back to keyword-only scoring when the Python service is unreachable", async () => {
    const session = baseSession();
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);
    jest.spyOn(Question, "findById").mockResolvedValue({
      ideal_answer: "A closure is a function bundled with its lexical scope.",
      keywords: ["closure", "scope"],
    });
    axios.post.mockRejectedValue(new Error("ECONNREFUSED"));

    const req = {
      body: { sessionId: "session1", questionIndex: 0, userAnswer: "closure and scope explained" },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    const payload = res.json.mock.calls[0][0];
    // Both keywords ("closure", "scope") appear in the answer → 100% keyword match
    expect(payload.scores.keyword).toBe(100);
    expect(payload.plagiarism.isOriginal).toBe(true);
    expect(session.save).toHaveBeenCalled();
  });
});

describe("completeSession", () => {
  test("aggregates scores into strong/weak areas and overall feedback", async () => {
    const session = {
      _id: "session1",
      user: "user1",
      answers: [
        { userAnswer: "a", category: "Frontend Development", scores: { semantic: 80, overall: 85 }, plagiarism: { isOriginal: true } },
        { userAnswer: "b", category: "Backend Development", scores: { semantic: 40, overall: 35 }, plagiarism: { isOriginal: true } },
      ],
      save: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);
    jest.spyOn(InterviewSession, "find").mockResolvedValue([
      { answers: [{ userAnswer: "a" }, { userAnswer: "b" }], summary: { averageOverallScore: 60 } },
    ]);
    jest.spyOn(User, "findByIdAndUpdate").mockResolvedValue(true);

    const req = { body: { sessionId: "session1" }, user: { _id: "user1" } };
    const res = mockRes();

    await completeSession(req, res);

    expect(session.status).toBe("completed");
    expect(session.summary.strongAreas).toEqual(["Frontend Development"]);
    expect(session.summary.weakAreas).toEqual(["Backend Development"]);
    expect(session.summary.averageOverallScore).toBe(60);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Interview session completed" })
    );
  });
});
