/**
 * Interview Completion Controller
 * Aggregates scores when a session finishes and updates cached user stats.
 * Fully deterministic — no calls to the Python NLP service.
 */

const InterviewSession = require("../../models/InterviewSession");
const User = require("../../models/User");

// ── Complete Session ─────────────────────────────────────────
// POST /api/interview/complete
// Body: { sessionId }

const completeSession = async (req, res) => {
  const { sessionId } = req.body;

  const session = await InterviewSession.findOne({
    _id: sessionId,
    user: req.user._id,
  });

  if (!session) {
    res.status(404);
    throw new Error("Session not found");
  }

  // Calculate session summary (deterministic aggregation).
  // Each answered follow-up counts as an additional graded item in the
  // same category as its parent question (follow-ups are scored the same
  // way a normal answer is — see answerController.submitFollowUpAnswer).
  const gradedItems = [];
  session.answers.forEach((a) => {
    if (a.userAnswer) {
      gradedItems.push({ category: a.category, scores: a.scores, plagiarism: a.plagiarism });
    }
    if (a.followUp && a.followUp.userAnswer) {
      gradedItems.push({ category: a.category, scores: a.followUp.scores, plagiarism: a.followUp.plagiarism });
    }
  });
  const count = gradedItems.length || 1;

  const avgSemantic = gradedItems.reduce((s, a) => s + a.scores.semantic, 0) / count;
  const avgOverall = gradedItems.reduce((s, a) => s + a.scores.overall, 0) / count;
  const plagiarismFlagged = gradedItems.filter((a) => !a.plagiarism.isOriginal).length;

  // Find weak and strong areas by category
  const categoryScores = {};
  gradedItems.forEach((a) => {
    if (!categoryScores[a.category]) categoryScores[a.category] = [];
    categoryScores[a.category].push(a.scores.overall);
  });

  const categoryAverages = Object.entries(categoryScores).map(([cat, scores]) => ({
    category: cat,
    avg: scores.reduce((s, v) => s + v, 0) / scores.length,
  }));

  const strongAreas = categoryAverages.filter((c) => c.avg >= 70).map((c) => c.category);
  const weakAreas = categoryAverages.filter((c) => c.avg < 50).map((c) => c.category);

  // Update session
  session.status = "completed";
  session.completedAt = new Date();
  session.summary = {
    averageSemanticScore: Math.round(avgSemantic),
    averageOverallScore: Math.round(avgOverall),
    plagiarismFlagged,
    strongAreas,
    weakAreas,
    overallFeedback: generateOverallFeedback(avgOverall),
  };

  await session.save();

  // Update user stats cache
  await updateUserStats(req.user._id);

  res.json({
    message: "Interview session completed",
    summary: session.summary,
    sessionId: session._id,
  });
};

// ── Helper: Generate overall session feedback ─────────────────

const generateOverallFeedback = (avgScore) => {
  if (avgScore >= 80) return "Excellent performance! You demonstrated strong conceptual understanding. Keep refining your answers with real-world examples.";
  if (avgScore >= 60) return "Good effort! Some areas need improvement. Focus on using technical terminology and structuring your answers more clearly.";
  if (avgScore >= 40) return "You have a foundation to build on. Review the weak areas identified and practice answering with specific examples.";
  return "This session highlighted areas for growth. Revisit fundamentals and practice mock interviews regularly.";
};

// ── Helper: Update cached user stats ─────────────────────────

const updateUserStats = async (userId) => {
  const sessions = await InterviewSession.find({ user: userId, status: "completed" });
  if (sessions.length === 0) return;

  const totalInterviews = sessions.length;
  const totalQuestions = sessions.reduce((s, sess) => {
    const answered = sess.answers.filter((a) => a.userAnswer).length;
    const followUpsAnswered = sess.answers.filter((a) => a.followUp && a.followUp.userAnswer).length;
    return s + answered + followUpsAnswered;
  }, 0);
  const avgScore = sessions.reduce((s, sess) => s + (sess.summary.averageOverallScore || 0), 0) / totalInterviews;

  await User.findByIdAndUpdate(userId, {
    "stats.totalInterviews": totalInterviews,
    "stats.averageScore": Math.round(avgScore),
    "stats.totalQuestions": totalQuestions,
  });
};

module.exports = { completeSession };
