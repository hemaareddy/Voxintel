/**
 * Interview Answer Controller
 * Submits and evaluates a single answer within an in-progress session.
 *
 * Deterministic: session/question lookup, DB writes, keyword fallback scoring.
 * AI-assisted: semantic evaluation delegated to the Python NLP service.
 */

const InterviewSession = require("../../models/InterviewSession");
const Question = require("../../models/Question");
const pythonNlpClient = require("../../services/pythonNlpClient");

// ── Submit Answer ────────────────────────────────────────────
// POST /api/interview/answer
// Body: { sessionId, questionIndex, userAnswer, answerMode, timeTakenSeconds }

const submitAnswer = async (req, res) => {
  const { sessionId, questionIndex, userAnswer, answerMode = "text", timeTakenSeconds = 0 } = req.body;

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

  // Get the ideal answer from the Question collection for evaluation
  const question = await Question.findById(answerEntry.questionId);
  const idealAnswer = question ? question.ideal_answer : "";
  const keywords = question ? question.keywords : [];

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

  await session.save();

  res.json({
    message: "Answer submitted and evaluated",
    scores: answerEntry.scores,
    confidence: answerEntry.confidence,
    plagiarism: answerEntry.plagiarism,
    feedback: answerEntry.feedback,
  });
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
