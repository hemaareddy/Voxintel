/**
 * Interview Session Controller
 * Starts sessions (question selection + hybrid generation) and reads session data.
 *
 * Deterministic: session creation, question retrieval, DB writes.
 * AI-assisted: hybrid question generation delegated to the Python NLP service.
 */

const InterviewSession = require("../../models/InterviewSession");
const Question = require("../../models/Question");
const Resume = require("../../models/Resume");
const pythonNlpClient = require("../../services/pythonNlpClient");

// ── Start Interview Session ──────────────────────────────────
// POST /api/interview/start
// Body: { resumeId, role, company, interviewType, difficulty, questionCount }

const startSession = async (req, res) => {
  const {
    resumeId,
    role,
    company = "General",
    interviewType,
    difficulty = "medium",
    questionCount = 10,
  } = req.body;

  // Validate required fields
  if (!role || !interviewType) {
    res.status(400);
    throw new Error("Please provide role and interviewType");
  }

  // Load resume if provided (for resume-aware question generation)
  let resumeData = null;
  if (resumeId) {
    resumeData = await Resume.findOne({ _id: resumeId, user: req.user._id });
    if (!resumeData) {
      res.status(404);
      throw new Error("Resume not found");
    }
  }

  // ── Question Selection ────────────────────────────────────
  // Map interview type to question category
  const categoryMap = {
    "Technical Interview": ["Backend Development", "Data Structures & Algorithms", "DBMS"],
    "Frontend Interview": ["Frontend Development"],
    "Backend Interview": ["Backend Development"],
    "Coding Round": ["Data Structures & Algorithms", "Python Development"],
    "AI/ML Interview": ["NLP / AI / ML", "Python Development"],
    "System Design Basics": ["System Design Basics"],
    "HR Interview": ["HR & Behavioral"],
    "Behavioral Interview": ["HR & Behavioral"],
    "MERN Stack": ["MERN Stack", "Frontend Development", "Backend Development"],
  };

  const targetCategories = categoryMap[interviewType] || [
    "Data Structures & Algorithms",
    "Backend Development",
  ];

  // Determine effective difficulty from resume intelligence (if available)
  let effectiveDifficulty = difficulty;
  let intelligence = null;

  if (resumeData && resumeData.status === "parsed" && resumeData.intelligence) {
    intelligence = resumeData.intelligence;
    // Map recommendedDifficulty → DB difficulty string
    const diffMap = {
      Beginner: "easy",
      Intermediate: "medium",
      Advanced: "hard",
      Expert: "hard",
    };
    const recommended = diffMap[intelligence.recommendedDifficulty];
    if (recommended) effectiveDifficulty = recommended;
  }

  // Build query filter using effective difficulty
  const filter = {
    category: { $in: targetCategories },
    difficulty: effectiveDifficulty,
  };

  // Fetch more dataset questions than needed so hybrid generator can select
  const datasetFetchCount = questionCount * 3;

  let datasetQuestionsRaw = [];

  if (company && company !== "General") {
    const companyQuestions = await Question.find({
      ...filter,
      company_tags: company,
    }).limit(datasetFetchCount);

    const generalIds = companyQuestions.map((q) => q._id);
    const generalQuestions = await Question.find({
      ...filter,
      _id: { $nin: generalIds },
    }).limit(datasetFetchCount - companyQuestions.length);

    datasetQuestionsRaw = [...companyQuestions, ...generalQuestions];
  } else {
    datasetQuestionsRaw = await Question.find(filter).limit(datasetFetchCount);
  }

  // Fallback if not enough questions at selected difficulty
  if (datasetQuestionsRaw.length < 4) {
    const existingIds = datasetQuestionsRaw.map((q) => q._id);
    const fallback = await Question.find({
      category: { $in: targetCategories },
      _id: { $nin: existingIds },
    }).limit(datasetFetchCount);
    datasetQuestionsRaw = [...datasetQuestionsRaw, ...fallback];
  }

  // ── Hybrid Generation (when resume is available) ──────────
  let finalQuestions = [];
  let questionSourceDistribution = { resume: 0, dataset: 0 };

  if (resumeData && resumeData.status === "parsed" && resumeData.parsed) {
    try {
      const hybridData = await pythonNlpClient.generateHybridQuestions({
        parsed: resumeData.parsed,
        intelligence: intelligence || {},
        datasetQuestions: datasetQuestionsRaw.map((q) => ({
          _id: q._id.toString(),
          question: q.question,
          difficulty: q.difficulty,
          category: q.category,
          ideal_answer: q.ideal_answer,
          keywords: q.keywords,
          evaluation_guidelines: q.evaluation_guidelines,
          follow_up_questions: q.follow_up_questions,
        })),
        count: questionCount,
        interviewType: interviewType,
      });

      finalQuestions = hybridData.questions || [];
      questionSourceDistribution = hybridData.distribution || { resume: 0, dataset: 0 };

      console.log(
        `✅ Hybrid questions: ${questionSourceDistribution.resume} resume + ` +
        `${questionSourceDistribution.dataset} dataset`
      );
    } catch (hybridErr) {
      // Fallback: use dataset-only questions if hybrid generation fails
      console.warn(`Hybrid generation failed, falling back to dataset: ${hybridErr.message}`);
      finalQuestions = datasetQuestionsRaw
        .sort(() => Math.random() - 0.5)
        .slice(0, questionCount)
        .map((q) => ({
          question: q.question,
          difficulty: q.difficulty,
          category: q.category,
          ideal_answer: q.ideal_answer,
          keywords: q.keywords,
          evaluation_guidelines: q.evaluation_guidelines,
          follow_up_questions: q.follow_up_questions,
          source: "dataset",
          questionId: q._id.toString(),
          is_generated: false,
        }));
      questionSourceDistribution = { resume: 0, dataset: finalQuestions.length };
    }
  } else {
    // No resume → pure dataset questions (existing behaviour preserved)
    finalQuestions = datasetQuestionsRaw
      .sort(() => Math.random() - 0.5)
      .slice(0, questionCount)
      .map((q) => ({
        question: q.question,
        difficulty: q.difficulty,
        category: q.category,
        ideal_answer: q.ideal_answer,
        keywords: q.keywords,
        evaluation_guidelines: q.evaluation_guidelines,
        follow_up_questions: q.follow_up_questions,
        source: "dataset",
        questionId: q._id.toString(),
        is_generated: false,
      }));
    questionSourceDistribution = { resume: 0, dataset: finalQuestions.length };
  }

  // Create the session in the database
  const sessionData = {
    user: req.user._id,
    resume: resumeId || null,
    config: {
      role,
      company,
      interviewType,
      difficulty: effectiveDifficulty,
      questionCount: finalQuestions.length,
    },
    answers: finalQuestions.map((q) => ({
      questionId: q.questionId || q._id || "",
      question: q.question,
      category: q.category,
      difficulty: q.difficulty,
      source: q.source || "dataset",
    })),
    questionSourceDistribution,
    status: "in_progress",
  };

  // Attach candidate intelligence snapshot if available
  if (intelligence) {
    sessionData.candidateIntelligence = {
      candidateLevel: intelligence.candidateLevel || null,
      readinessScore: intelligence.readinessScore || null,
      recommendedDifficulty: intelligence.recommendedDifficulty || null,
      strengths: intelligence.strengths || [],
      improvementAreas: intelligence.improvementAreas || [],
    };
  }

  const session = await InterviewSession.create(sessionData);

  res.status(201).json({
    sessionId: session._id,
    questions: finalQuestions.map((q, idx) => ({
      index: idx,
      questionId: q.questionId || "",
      question: q.question,
      category: q.category,
      difficulty: q.difficulty,
      source: q.source || "dataset",
      followUpQuestions: q.follow_up_questions || [],
    })),
    config: session.config,
    // Phase 1: expose intelligence + distribution to the frontend
    candidateIntelligence: session.candidateIntelligence || null,
    questionSourceDistribution,
  });
};

// ── Get Session Details ──────────────────────────────────────
// GET /api/interview/:sessionId

const getSession = async (req, res) => {
  const session = await InterviewSession.findOne({
    _id: req.params.sessionId,
    user: req.user._id,
  });

  if (!session) {
    res.status(404);
    throw new Error("Session not found");
  }

  res.json({ session });
};

// ── Get Session History ──────────────────────────────────────
// GET /api/interview/history

const getHistory = async (req, res) => {
  const sessions = await InterviewSession.find({ user: req.user._id })
    .select("config summary status startedAt completedAt")
    .sort({ startedAt: -1 })
    .limit(20);

  res.json({ sessions });
};

module.exports = { startSession, getSession, getHistory };
