/**
 * Analytics Controller
 * Aggregates performance data for the dashboard.
 * Pure deterministic logic — no AI, just data aggregation.
 */

const InterviewSession = require("../models/InterviewSession");

// ── Dashboard Analytics ──────────────────────────────────────
// GET /api/analytics/dashboard

const getDashboard = async (req, res) => {
  const userId = req.user._id;

  // Fetch all completed sessions for this user
  const sessions = await InterviewSession.find({
    user: userId,
    status: "completed",
  }).sort({ completedAt: 1 });

  if (sessions.length === 0) {
    return res.json({
      totalInterviews: 0,
      averageScore: 0,
      totalQuestions: 0,
      scoreTrend: [],
      categoryBreakdown: {},
      confidenceTrend: [],
      plagiarismStats: { flagged: 0, total: 0 },
      weakAreas: [],
      strongAreas: [],
      recentSessions: [],
    });
  }

  // ── Aggregate metrics ────────────────────────────────────

  const totalInterviews = sessions.length;
  const totalQuestions = sessions.reduce(
    (s, sess) => s + sess.answers.filter((a) => a.userAnswer).length,
    0
  );
  const averageScore = Math.round(
    sessions.reduce((s, sess) => s + (sess.summary.averageOverallScore || 0), 0) /
      totalInterviews
  );

  // Score trend over time (one point per session)
  const scoreTrend = sessions.map((sess) => ({
    date: sess.completedAt,
    score: sess.summary.averageOverallScore || 0,
    role: sess.config.role,
  }));

  // Category breakdown — average score per category
  const categoryMap = {};
  sessions.forEach((sess) => {
    sess.answers.forEach((a) => {
      if (!a.userAnswer || !a.category) return;
      if (!categoryMap[a.category]) categoryMap[a.category] = { total: 0, count: 0 };
      categoryMap[a.category].total += a.scores.overall || 0;
      categoryMap[a.category].count += 1;
    });
  });

  const categoryBreakdown = Object.fromEntries(
    Object.entries(categoryMap).map(([cat, data]) => [
      cat,
      Math.round(data.total / data.count),
    ])
  );

  // Confidence trend (only sessions with confidence data)
  const confidenceTrend = sessions
    .map((sess) => {
      const scoresWithConfidence = sess.answers
        .filter((a) => a.confidence && a.confidence.score !== null)
        .map((a) => a.confidence.score);

      if (scoresWithConfidence.length === 0) return null;

      const avgConf =
        scoresWithConfidence.reduce((s, v) => s + v, 0) / scoresWithConfidence.length;

      return { date: sess.completedAt, confidenceScore: Math.round(avgConf) };
    })
    .filter(Boolean);

  // Plagiarism stats
  let totalAnswers = 0;
  let flaggedAnswers = 0;
  sessions.forEach((sess) => {
    sess.answers.forEach((a) => {
      if (!a.userAnswer) return;
      totalAnswers++;
      if (a.plagiarism && !a.plagiarism.isOriginal) flaggedAnswers++;
    });
  });

  // Weak and strong areas (aggregate across all sessions)
  const weakAreaCount = {};
  const strongAreaCount = {};
  sessions.forEach((sess) => {
    (sess.summary.weakAreas || []).forEach((area) => {
      weakAreaCount[area] = (weakAreaCount[area] || 0) + 1;
    });
    (sess.summary.strongAreas || []).forEach((area) => {
      strongAreaCount[area] = (strongAreaCount[area] || 0) + 1;
    });
  });

  const weakAreas = Object.entries(weakAreaCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area]) => area);

  const strongAreas = Object.entries(strongAreaCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area]) => area);

  // Recent sessions for the history list
  const recentSessions = sessions
    .slice(-5)
    .reverse()
    .map((sess) => ({
      _id: sess._id,
      role: sess.config.role,
      company: sess.config.company,
      interviewType: sess.config.interviewType,
      score: sess.summary.averageOverallScore,
      date: sess.completedAt,
      questionsAnswered: sess.answers.filter((a) => a.userAnswer).length,
    }));

  // ── Phase 1: Resume Intelligence Aggregation ─────────────

  // Aggregate question source distribution across all sessions
  let totalResumeQuestions = 0;
  let totalDatasetQuestions = 0;

  sessions.forEach((sess) => {
    totalResumeQuestions += sess.questionSourceDistribution?.resume || 0;
    totalDatasetQuestions += sess.questionSourceDistribution?.dataset || 0;
  });

  // Most recent candidate intelligence snapshot (from last session with one)
  const sessionsWithIntelligence = sessions
    .filter((s) => s.candidateIntelligence && s.candidateIntelligence.readinessScore != null)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

  const latestIntelligence = sessionsWithIntelligence.length > 0
    ? sessionsWithIntelligence[0].candidateIntelligence
    : null;

  res.json({
    totalInterviews,
    averageScore,
    totalQuestions,
    scoreTrend,
    categoryBreakdown,
    confidenceTrend,
    plagiarismStats: { flagged: flaggedAnswers, total: totalAnswers },
    weakAreas,
    strongAreas,
    recentSessions,
    // Phase 1 additions
    questionSourceDistribution: {
      resume: totalResumeQuestions,
      dataset: totalDatasetQuestions,
    },
    latestIntelligence,
  });
};

module.exports = { getDashboard };
