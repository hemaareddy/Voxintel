/**
 * Interview Answer Controller
 * Submits and evaluates a single answer within an in-progress session.
 * Follow-up-eligible questions also get an adaptive follow-up generated
 * after their primary answer is scored, and a second submission (with
 * isFollowUp: true) evaluates the candidate's answer to that follow-up.
 * Coding-round questions (type: "coding") are graded differently: the
 * submitted code is actually run against test cases in whichever language
 * was submitted (see services/execution/index.js), not evaluated by the
 * Python NLP service.
 *
 * Deterministic: session/question lookup, DB writes, keyword fallback scoring,
 * code execution grading.
 * AI-assisted: semantic evaluation and follow-up generation delegated to the Python NLP service.
 */

const mongoose = require("mongoose");
const InterviewSession = require("../../models/InterviewSession");
const Question = require("../../models/Question");
const pythonNlpClient = require("../../services/pythonNlpClient");
const codeExecution = require("../../services/execution");

// ── Helper: look up a dataset Question by id, tolerating resume-generated
// questions (source: "resume") which have no real Question document —
// their questionId is "" rather than a valid ObjectId, and Question.findById
// throws a CastError on an invalid id instead of returning null.
const findQuestionSafely = (questionId) => {
  if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) return null;
  return Question.findById(questionId);
};

// ── Helper: resolve the reference answer/keywords to evaluate against.
// Sessions created after sessionController started denormalizing these onto
// the answer entry (see InterviewSession.js's answerSchema comment) already
// have them — this is required for resume-generated questions, which have
// no backing Question document to look up at all. Falls back to a live
// Question lookup only for sessions created before that change.
const resolveReferenceAnswer = async (answerEntry) => {
  if (answerEntry.idealAnswer || (answerEntry.keywords && answerEntry.keywords.length > 0)) {
    return { idealAnswer: answerEntry.idealAnswer || "", keywords: answerEntry.keywords || [] };
  }
  const question = await findQuestionSafely(answerEntry.questionId);
  return { idealAnswer: question ? question.ideal_answer : "", keywords: question ? question.keywords : [] };
};

// ── Submit Answer ────────────────────────────────────────────
// POST /api/interview/answer
// Body: { sessionId, questionIndex, userAnswer, answerMode, timeTakenSeconds, isFollowUp }

const submitAnswer = async (req, res) => {
  const {
    sessionId,
    questionIndex,
    userAnswer,
    answerMode = "text",
    timeTakenSeconds = 0,
    isFollowUp = false,
    language = "javascript",
  } = req.body;

  if (!sessionId || questionIndex === undefined || !userAnswer) {
    res.status(400);
    throw new Error("sessionId, questionIndex, and userAnswer are required");
  }

  const session = await InterviewSession.findOne({
    _id: sessionId,
    user: req.user._id,
    status: "in_progress",
  });

  if (!session) {
    res.status(404);
    throw new Error("Active session not found");
  }

  if (questionIndex >= session.answers.length) {
    res.status(400);
    throw new Error("Invalid question index");
  }

  const answerEntry = session.answers[questionIndex];

  if (isFollowUp) {
    return submitFollowUpAnswer({ res, session, answerEntry, userAnswer, answerMode, timeTakenSeconds });
  }

  if (answerEntry.type === "coding") {
    return submitCodeAnswer({ res, session, answerEntry, userAnswer, answerMode, timeTakenSeconds, language });
  }

  const { idealAnswer, keywords } = await resolveReferenceAnswer(answerEntry);

  // ── AI-Assisted: Call Python evaluation service ───────────
  let evaluation = defaultEvaluation();

  try {
    evaluation = await pythonNlpClient.evaluateAnswer({
      userAnswer,
      idealAnswer,
      keywords,
      answerMode,
      timeTakenSeconds,
    });
  } catch (pyError) {
    // If Python service is down, use a simple fallback
    console.warn("Python service unavailable, using fallback evaluation");
    evaluation = fallbackEvaluation(userAnswer, keywords);
  }

  // Update the answer entry in the session
  answerEntry.userAnswer = userAnswer;
  answerEntry.answerMode = answerMode;
  answerEntry.timeTakenSeconds = timeTakenSeconds;
  answerEntry.scores = {
    semantic: evaluation.semantic_score || 0,
    keyword: evaluation.keyword_score || 0,
    completeness: evaluation.completeness_score || 0,
    overall: evaluation.overall_score || 0,
  };
  answerEntry.confidence = evaluation.confidence || {};
  answerEntry.plagiarism = evaluation.plagiarism || {};
  answerEntry.feedback = evaluation.feedback || "";

  // ── Adaptive Follow-up: generate one based on keyword coverage ──
  let followUpQuestion = null;
  if (answerEntry.followUpEligible && !answerEntry.hadFollowUp) {
    try {
      const followUp = await pythonNlpClient.generateFollowup({ userAnswer, keywords });
      answerEntry.followUp = { question: followUp.question, basedOn: followUp.based_on };
      answerEntry.hadFollowUp = true;
      followUpQuestion = followUp.question;
    } catch (followUpErr) {
      console.warn(`Follow-up generation failed: ${followUpErr.message}`);
    }
  }

  await session.save();

  res.json({
    message: "Answer submitted and evaluated",
    scores: answerEntry.scores,
    confidence: answerEntry.confidence,
    plagiarism: answerEntry.plagiarism,
    feedback: answerEntry.feedback,
    followUpQuestion,
  });
};

// ── Submit an answer to a previously-generated follow-up question ────
// For a text question, reuses the parent's ideal answer/keywords. For a
// coding question, there's no ideal_answer (the follow-up is answered in
// prose about the code, not more code) — its expectedConcepts double as
// the keyword list instead.

const submitFollowUpAnswer = async ({ res, session, answerEntry, userAnswer, answerMode, timeTakenSeconds }) => {
  if (!answerEntry.followUp || !answerEntry.followUp.question) {
    res.status(400);
    throw new Error("No follow-up question is pending for this answer");
  }

  let idealAnswer = "";
  let keywords = [];
  if (answerEntry.type === "coding") {
    keywords = answerEntry.expectedConcepts || [];
  } else {
    ({ idealAnswer, keywords } = await resolveReferenceAnswer(answerEntry));
  }

  let evaluation = defaultEvaluation();
  try {
    evaluation = await pythonNlpClient.evaluateAnswer({
      userAnswer,
      idealAnswer,
      keywords,
      answerMode,
      timeTakenSeconds,
    });
  } catch (pyError) {
    console.warn("Python service unavailable, using fallback evaluation for follow-up");
    evaluation = fallbackEvaluation(userAnswer, keywords);
  }

  answerEntry.followUp.userAnswer = userAnswer;
  answerEntry.followUp.answerMode = answerMode;
  answerEntry.followUp.timeTakenSeconds = timeTakenSeconds;
  answerEntry.followUp.scores = {
    semantic: evaluation.semantic_score || 0,
    keyword: evaluation.keyword_score || 0,
    completeness: evaluation.completeness_score || 0,
    overall: evaluation.overall_score || 0,
  };
  answerEntry.followUp.confidence = evaluation.confidence || {};
  answerEntry.followUp.plagiarism = evaluation.plagiarism || {};
  answerEntry.followUp.feedback = evaluation.feedback || "";

  await session.save();

  res.json({
    message: "Follow-up answer submitted and evaluated",
    scores: answerEntry.followUp.scores,
    confidence: answerEntry.followUp.confidence,
    plagiarism: answerEntry.followUp.plagiarism,
    feedback: answerEntry.followUp.feedback,
  });
};

// ── Submit code for a coding-round question ───────────────────
// Actually runs the candidate's code against the question's test cases
// (public + hidden) using the executor for whichever language was submitted
// — see services/execution/index.js (only JavaScript is actually sandboxed;
// see its header comment before assuming Python/Java are safe to expose publicly).
// Hidden test case inputs/expected values are never sent back to the client,
// only a pass/fail summary. Follow-up-eligible (Coding Interview only —
// see sessionController) questions also get an adaptive follow-up about
// the submission's complexity/edge cases, answered in prose.

const submitCodeAnswer = async ({ res, session, answerEntry, userAnswer, answerMode, timeTakenSeconds, language = "javascript" }) => {
  const resolvedLanguage = codeExecution.SUPPORTED_LANGUAGES.includes(language) ? language : "javascript";

  const allTestCases = [
    ...answerEntry.testCases.map((tc) => ({ args: tc.args, expected: tc.expected, hidden: false })),
    ...answerEntry.hiddenTestCases.map((tc) => ({ args: tc.args, expected: tc.expected, hidden: true })),
  ];

  const results = await codeExecution.runCode(
    resolvedLanguage,
    userAnswer,
    answerEntry.functionName,
    allTestCases,
    answerEntry.compareMode
  );

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  answerEntry.userAnswer = userAnswer;
  answerEntry.answerMode = answerMode;
  answerEntry.language = resolvedLanguage;
  answerEntry.timeTakenSeconds = timeTakenSeconds;
  answerEntry.scores = {
    semantic: passRate,
    keyword: passRate,
    completeness: passRate,
    overall: passRate,
  };
  answerEntry.testResults = results.map((r, i) => ({
    passed: r.passed,
    actualOutput: r.actualOutput,
    expectedOutput: r.expectedOutput,
    error: r.error,
    hidden: allTestCases[i].hidden,
  }));
  answerEntry.feedback = buildCodeFeedback(passedCount, totalCount, results, allTestCases);
  answerEntry.plagiarism = { score: 0, aiScore: 0, isOriginal: true };
  answerEntry.confidence = {};

  // ── Adaptive follow-up (Coding Interview sessions only) ──────
  let followUpQuestion = null;
  if (answerEntry.followUpEligible && !answerEntry.hadFollowUp) {
    try {
      const firstPublicFailureIdx = results.findIndex((r, i) => !r.passed && !allTestCases[i].hidden);
      const firstPublicFailure = firstPublicFailureIdx === -1
        ? null
        : { args: allTestCases[firstPublicFailureIdx].args, expected: allTestCases[firstPublicFailureIdx].expected };

      const followUp = await pythonNlpClient.generateCodeFollowup({
        passedCount,
        totalCount,
        expectedConcepts: answerEntry.expectedConcepts || [],
        firstPublicFailure,
      });
      answerEntry.followUp = { question: followUp.question, basedOn: followUp.based_on };
      answerEntry.hadFollowUp = true;
      followUpQuestion = followUp.question;
    } catch (followUpErr) {
      console.warn(`Code follow-up generation failed: ${followUpErr.message}`);
    }
  }

  await session.save();

  const publicResults = answerEntry.testResults
    .filter((r) => !r.hidden)
    .map((r) => ({ passed: r.passed, actualOutput: r.actualOutput, expectedOutput: r.expectedOutput, error: r.error }));
  const hiddenSummary = {
    passed: answerEntry.testResults.filter((r) => r.hidden && r.passed).length,
    total: answerEntry.testResults.filter((r) => r.hidden).length,
  };

  res.json({
    message: "Code submitted and evaluated",
    scores: answerEntry.scores,
    testResults: publicResults,
    hiddenTestSummary: hiddenSummary,
    feedback: answerEntry.feedback,
    followUpQuestion,
  });
};

// ── Helper: build code-grading feedback without leaking hidden test details ──

const buildCodeFeedback = (passedCount, totalCount, results, testCases) => {
  if (totalCount > 0 && passedCount === totalCount) {
    return `All ${totalCount} test cases passed! Great work.`;
  }

  const firstPublicFailureIdx = results.findIndex((r, i) => !r.passed && !testCases[i].hidden);
  const hiddenFailedCount = results.filter((r, i) => !r.passed && testCases[i].hidden).length;

  let message = `${passedCount}/${totalCount} test cases passed.`;

  if (firstPublicFailureIdx !== -1) {
    const failure = results[firstPublicFailureIdx];
    const testCase = testCases[firstPublicFailureIdx];
    if (failure.error) {
      message += ` Your code threw an error on input ${JSON.stringify(testCase.args)}: ${failure.error}`;
    } else {
      message += ` For input ${JSON.stringify(testCase.args)}, expected ${JSON.stringify(failure.expectedOutput)} but got ${JSON.stringify(failure.actualOutput)}.`;
    }
  } else if (hiddenFailedCount > 0) {
    message += ` All visible examples passed, but ${hiddenFailedCount} additional hidden test case(s) failed — check edge cases like empty input, duplicates, or boundary values.`;
  }

  return message;
};

// ── Helper: Default evaluation when Python service is unavailable ──

const defaultEvaluation = () => ({
  semantic_score: 0,
  keyword_score: 0,
  completeness_score: 0,
  overall_score: 0,
  confidence: { score: null },
  plagiarism: { score: 0, isOriginal: true },
  feedback: "Evaluation service temporarily unavailable.",
});

// ── Helper: Simple keyword-based fallback evaluation ──────────

const fallbackEvaluation = (userAnswer, keywords) => {
  const lower = userAnswer.toLowerCase();
  const matched = keywords.filter((k) => lower.includes(k.toLowerCase())).length;
  const keywordScore = keywords.length > 0 ? (matched / keywords.length) * 100 : 50;
  const completeness = Math.min(100, (userAnswer.split(" ").length / 50) * 100);
  const overall = Math.round((keywordScore + completeness) / 2);

  return {
    semantic_score: Math.round(keywordScore),
    keyword_score: Math.round(keywordScore),
    completeness_score: Math.round(completeness),
    overall_score: overall,
    confidence: { score: null, feedback: "Voice analysis not available" },
    plagiarism: { score: 0, isOriginal: true, feedback: "Plagiarism check not available" },
    feedback: `Your answer matched ${matched} of ${keywords.length} key terms. Try to elaborate more on core concepts.`,
  };
};

module.exports = { submitAnswer };
