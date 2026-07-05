/**
 * Tests for the adaptive follow-up flow in answerController.js:
 * - a follow-up-eligible answer gets a generated follow-up question
 * - a non-eligible answer does not
 * - submitting an answer to that follow-up (isFollowUp: true) scores it
 *   and stores it separately from the primary answer
 * - submitting a follow-up answer when none is pending is rejected
 *
 * pythonNlpClient is mocked directly (rather than axios) since a single
 * request can trigger two distinct Python calls here (evaluate + follow-up
 * generation) and mocking at the client-function level keeps each test's
 * intent obvious.
 */

const InterviewSession = require("../../server/models/InterviewSession");
const Question = require("../../server/models/Question");
const pythonNlpClient = require("../../server/services/pythonNlpClient");
const { submitAnswer } = require("../../server/controllers/interview/answerController");

jest.mock("../../server/services/pythonNlpClient");

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function baseSession({ followUpEligible = false } = {}) {
  return {
    _id: "session1",
    user: "user1",
    status: "in_progress",
    answers: [
      {
        questionId: "507f1f77bcf86cd799439011",
        question: "Explain closures.",
        category: "Frontend Development",
        userAnswer: "",
        scores: {},
        confidence: {},
        plagiarism: {},
        feedback: "",
        followUpEligible,
        hadFollowUp: false,
        followUp: undefined,
      },
    ],
    save: jest.fn().mockResolvedValue(true),
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe("adaptive follow-up generation", () => {
  test("a follow-up-eligible answer gets a generated follow-up question", async () => {
    const session = baseSession({ followUpEligible: true });
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);
    jest.spyOn(Question, "findById").mockResolvedValue({
      ideal_answer: "A closure is a function bundled with its lexical scope.",
      keywords: ["closure", "scope"],
    });
    pythonNlpClient.evaluateAnswer.mockResolvedValue({
      semantic_score: 80,
      keyword_score: 70,
      completeness_score: 60,
      overall_score: 72,
      confidence: {},
      plagiarism: { isOriginal: true },
      feedback: "Good.",
    });
    pythonNlpClient.generateFollowup.mockResolvedValue({
      question: 'You mentioned "closure" — can you go deeper?',
      based_on: "matched:closure",
    });

    const req = {
      body: { sessionId: "session1", questionIndex: 0, userAnswer: "A closure keeps scope." },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    expect(pythonNlpClient.generateFollowup).toHaveBeenCalledWith({
      userAnswer: "A closure keeps scope.",
      keywords: ["closure", "scope"],
    });
    const payload = res.json.mock.calls[0][0];
    expect(payload.followUpQuestion).toBe('You mentioned "closure" — can you go deeper?');
    expect(session.answers[0].hadFollowUp).toBe(true);
    expect(session.answers[0].followUp.question).toBe('You mentioned "closure" — can you go deeper?');
    expect(session.save).toHaveBeenCalled();
  });

  test("a non-eligible answer does not get a follow-up", async () => {
    const session = baseSession({ followUpEligible: false });
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);
    jest.spyOn(Question, "findById").mockResolvedValue({ ideal_answer: "x", keywords: [] });
    pythonNlpClient.evaluateAnswer.mockResolvedValue({
      semantic_score: 80,
      keyword_score: 70,
      completeness_score: 60,
      overall_score: 72,
      confidence: {},
      plagiarism: { isOriginal: true },
      feedback: "Good.",
    });

    const req = {
      body: { sessionId: "session1", questionIndex: 0, userAnswer: "some answer" },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    expect(pythonNlpClient.generateFollowup).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.followUpQuestion).toBeNull();
  });

  test("submitting a follow-up answer scores it and stores it separately from the primary answer", async () => {
    const session = baseSession({ followUpEligible: true });
    session.answers[0].hadFollowUp = true;
    session.answers[0].followUp = {
      question: "Go deeper on closures?",
      basedOn: "matched:closure",
      userAnswer: "",
    };
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);
    jest.spyOn(Question, "findById").mockResolvedValue({ ideal_answer: "x", keywords: ["closure"] });
    pythonNlpClient.evaluateAnswer.mockResolvedValue({
      semantic_score: 90,
      keyword_score: 100,
      completeness_score: 80,
      overall_score: 90,
      confidence: {},
      plagiarism: { isOriginal: true },
      feedback: "Great depth.",
    });

    const req = {
      body: {
        sessionId: "session1",
        questionIndex: 0,
        userAnswer: "Deeper closure explanation.",
        isFollowUp: true,
      },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    expect(pythonNlpClient.generateFollowup).not.toHaveBeenCalled(); // no chained follow-ups
    expect(session.answers[0].followUp.userAnswer).toBe("Deeper closure explanation.");
    expect(session.answers[0].followUp.scores.overall).toBe(90);
    expect(session.answers[0].userAnswer).toBe(""); // primary answer untouched
    const payload = res.json.mock.calls[0][0];
    expect(payload.scores.overall).toBe(90);
  });

  test("a resume-generated question (no backing Question document) does not crash evaluation", async () => {
    // Resume-generated questions have questionId: "" (see sessionController) since
    // they aren't backed by a real Question document — Question.findById("") throws
    // a CastError rather than returning null, so it must never be called for these.
    const session = baseSession({ followUpEligible: false });
    session.answers[0].questionId = "";
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);
    const findByIdSpy = jest.spyOn(Question, "findById");
    pythonNlpClient.evaluateAnswer.mockResolvedValue({
      semantic_score: 60,
      keyword_score: 50,
      completeness_score: 40,
      overall_score: 52,
      confidence: {},
      plagiarism: { isOriginal: true },
      feedback: "Decent.",
    });

    const req = {
      body: { sessionId: "session1", questionIndex: 0, userAnswer: "some answer" },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await submitAnswer(req, res);

    expect(findByIdSpy).not.toHaveBeenCalled();
    expect(pythonNlpClient.evaluateAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ idealAnswer: "", keywords: [] })
    );
    const payload = res.json.mock.calls[0][0];
    expect(payload.scores.overall).toBe(52);
  });

  test("submitting a follow-up answer when none is pending is rejected", async () => {
    const session = baseSession({ followUpEligible: false });
    jest.spyOn(InterviewSession, "findOne").mockResolvedValue(session);

    const req = {
      body: { sessionId: "session1", questionIndex: 0, userAnswer: "answer", isFollowUp: true },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await expect(submitAnswer(req, res)).rejects.toThrow("No follow-up question is pending");
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
