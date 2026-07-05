/**
 * Tests for sessionController's coding-round branch: "Coding Interview" and
 * "Coding Round" interview types should skip the dataset/hybrid Q&A flow
 * entirely and build a session from generateCodingQuestions.
 */

const InterviewSession = require("../../server/models/InterviewSession");
const Question = require("../../server/models/Question");
const pythonNlpClient = require("../../server/services/pythonNlpClient");
const { startSession } = require("../../server/controllers/interview/sessionController");

jest.mock("../../server/services/pythonNlpClient");

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

const sampleCodingQuestions = [
  {
    id: "two-sum",
    title: "Two Sum",
    prompt: "Return indices of the two numbers that add up to target.",
    category: "Data Structures & Algorithms",
    difficulty: "easy",
    source: "dataset",
    type: "coding",
    function_name: "twoSum",
    starter_code: "function twoSum(nums, target) {}",
    compare_mode: "unordered",
    test_cases: [{ args: [[2, 7], 9], expected: [0, 1] }],
    hidden_test_cases: [{ args: [[1, 5], 6], expected: [0, 1] }],
    expected_concepts: ["hash map"],
  },
  {
    id: "reverse-string",
    title: "Reverse a String",
    prompt: "Reverse the given string.",
    category: "Data Structures & Algorithms",
    difficulty: "easy",
    source: "resume",
    type: "coding",
    function_name: "reverseString",
    starter_code: "function reverseString(str) {}",
    test_cases: [{ args: ["hi"], expected: "ih" }],
    hidden_test_cases: [],
    expected_concepts: ["strings"],
  },
];

describe("startSession — coding interview types", () => {
  test.each([
    ["Coding Interview", true],
    ["Coding Round", false],
  ])(
    "%s bypasses the dataset flow and returns coding questions (followUpEligible=%s)",
    async (interviewType, expectedFollowUpEligible) => {
      pythonNlpClient.generateCodingQuestions.mockResolvedValue({
        questions: sampleCodingQuestions,
        count: 2,
      });
      const findSpy = jest.spyOn(Question, "find");
      let capturedAnswers;
      jest.spyOn(InterviewSession, "create").mockImplementation(async (data) => {
        capturedAnswers = data.answers;
        return { _id: "session1", ...data };
      });

      const req = {
        body: { role: "Backend Developer", interviewType, difficulty: "easy", questionCount: 2 },
        user: { _id: "user1" },
      };
      const res = mockRes();

      await startSession(req, res);

      expect(findSpy).not.toHaveBeenCalled(); // no dataset Question lookup at all
      expect(res.status).toHaveBeenCalledWith(201);
      const payload = res.json.mock.calls[0][0];
      expect(payload.questions).toHaveLength(2);
      expect(payload.questions[0].type).toBe("coding");
      expect(payload.questions[0].starterCode).toBeDefined();
      expect(payload.questions[0].testCases).toBeDefined();
      // hidden test cases must never reach the response
      expect(JSON.stringify(payload)).not.toContain("hidden_test_cases");
      expect(payload.questionSourceDistribution).toEqual({ resume: 1, dataset: 1 });

      // stored session data keeps hidden test cases + expected concepts
      // server-side, and marks follow-up eligibility per interviewType:
      // Coding Interview asks follow-ups, Coding Round doesn't.
      expect(capturedAnswers[0].hiddenTestCases).toHaveLength(1);
      expect(capturedAnswers.every((a) => a.followUpEligible === expectedFollowUpEligible)).toBe(true);
      expect(capturedAnswers.every((a) => a.type === "coding")).toBe(true);
      expect(capturedAnswers[0].expectedConcepts).toEqual(["hash map"]);
    }
  );

  test("propagates a clear error if coding question generation fails", async () => {
    pythonNlpClient.generateCodingQuestions.mockRejectedValue(new Error("Python service down"));

    const req = {
      body: { role: "Backend Developer", interviewType: "Coding Round", questionCount: 5 },
      user: { _id: "user1" },
    };
    const res = mockRes();

    await expect(startSession(req, res)).rejects.toThrow("Could not generate coding questions");
    expect(res.status).toHaveBeenCalledWith(502);
  });
});
