/**
 * InterviewSession Model
 * Tracks a complete mock interview: questions asked, answers given,
 * evaluation scores, and session-level analytics.
 */

const mongoose = require("mongoose");

// ── Shared field definitions (reused by the primary answer and its
// follow-up, since a follow-up is graded the same way a normal answer is) ──

const scoreFields = {
  semantic: { type: Number, default: 0 },      // 0-100: meaning similarity
  keyword: { type: Number, default: 0 },        // 0-100: technical terms used
  completeness: { type: Number, default: 0 },   // 0-100: answer depth
  overall: { type: Number, default: 0 },        // weighted composite
};

const confidenceFields = {
  score: { type: Number, default: null },
  fillerWordCount: { type: Number, default: 0 },
  speechSpeed: { type: String, default: null }, // "slow" | "normal" | "fast"
  feedback: { type: String, default: null },
};

const plagiarismFields = {
  score: { type: Number, default: 0 },    // 0-100: how plagiarised
  aiScore: { type: Number, default: 0 },  // 0-100: likelihood AI-generated
  isOriginal: { type: Boolean, default: true },
  feedback: { type: String, default: null },
};

// ── Sub-schemas: coding-round test cases + graded results ────────
// A coding question's `args`/`expected` are JSON-serializable values passed
// to/compared against the candidate's submitted function (see
// server/services/codeExecutionService.js). hiddenTestCases are graded but
// never sent to the frontend.

const testCaseSchema = new mongoose.Schema(
  { args: mongoose.Schema.Types.Mixed, expected: mongoose.Schema.Types.Mixed },
  { _id: false }
);

const testResultSchema = new mongoose.Schema(
  {
    passed: { type: Boolean, default: false },
    actualOutput: mongoose.Schema.Types.Mixed,
    expectedOutput: mongoose.Schema.Types.Mixed,
    error: { type: String, default: null },
    hidden: { type: Boolean, default: false }, // graded against a hidden test case
  },
  { _id: false }
);

// ── Sub-schema: an adaptive follow-up question + its answer ──────
// Generated after a follow-up-eligible answer, based on which keywords
// the candidate's answer did or didn't cover (see followup_generator.py).

const followUpSchema = new mongoose.Schema(
  {
    question: { type: String, default: null },
    basedOn: { type: String, default: null }, // e.g. "missing:react" | "matched:redux" | "generic"
    userAnswer: { type: String, default: "" },
    answerMode: { type: String, enum: ["text", "voice"], default: "text" },
    timeTakenSeconds: { type: Number, default: 0 },
    scores: scoreFields,
    confidence: confidenceFields,
    plagiarism: plagiarismFields,
    feedback: { type: String, default: "" },
  },
  { _id: false }
);

// ── Sub-schema: A single question + answer pair ─────────────

const answerSchema = new mongoose.Schema({
  questionId: { type: String },
  question: { type: String, required: true },
  category: { type: String },
  difficulty: { type: String },

  // Reference answer + expected keywords, captured at session-creation time
  // (from the dataset Question or, for resume-generated questions, the
  // hybrid generator's templated ideal_answer/concepts). Stored directly
  // here rather than re-fetched from the Question collection at grading
  // time, because resume-generated questions have no backing Question
  // document at all — questionId is "" for them. Without this, evaluation
  // silently fell back to empty ideal_answer/keywords, which makes both
  // semantic and keyword scoring hit their neutral "no reference" default
  // regardless of answer quality (see answerController.submitAnswer).
  idealAnswer: { type: String, default: "" },
  keywords: [String],

  // The user's submitted answer
  userAnswer: { type: String, default: "" },
  answerMode: { type: String, enum: ["text", "voice"], default: "text" },
  timeTakenSeconds: { type: Number, default: 0 },

  // Scores from the Python NLP evaluation service
  scores: scoreFields,

  // Confidence analysis (if voice input was used)
  confidence: confidenceFields,

  // Plagiarism / AI detection results
  plagiarism: plagiarismFields,

  // Personalized feedback text
  feedback: { type: String, default: "" },

  // Adaptive follow-up: eligible questions get a follow-up generated
  // after their primary answer is scored (see sessionController's
  // eligibility selection and answerController's generation step).
  followUpEligible: { type: Boolean, default: false },
  hadFollowUp: { type: Boolean, default: false },
  followUp: followUpSchema,

  // Phase 1: Question source tracking
  source: { type: String, enum: ["resume", "dataset", "generated"], default: "dataset" },

  // Coding-round questions: "coding" instead of the default "qa". The
  // candidate's submitted code is stored in `userAnswer` (same field as a
  // text answer) — its content just happens to be JS rather than prose.
  type: { type: String, enum: ["qa", "coding"], default: "qa" },
  functionName: { type: String, default: null },
  // Per-language starter code, e.g. { javascript: "...", python: "...", java: "..." }.
  // Only languages the question actually supports have a key.
  starterCode: { type: mongoose.Schema.Types.Mixed, default: null },
  language: { type: String, enum: ["javascript", "python", "java"], default: "javascript" },
  compareMode: { type: String, enum: ["exact", "unordered"], default: "exact" },
  testCases: [testCaseSchema],
  hiddenTestCases: [testCaseSchema],
  testResults: [testResultSchema],
  // Topics this problem exercises (e.g. "hash map", "recursion") — used to
  // phrase both the problem's UI hint and, for Coding Interview sessions,
  // the adaptive code follow-up question / its keyword-based evaluation.
  expectedConcepts: [String],
});

// ── Main Session Schema ─────────────────────────────────────

const interviewSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    resume: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
    },

    // Session configuration (chosen by user in setup screen)
    config: {
      role: { type: String, required: true },        // e.g. "Frontend Developer"
      company: { type: String, default: "General" }, // e.g. "Google"
      interviewType: { type: String, required: true }, // "Technical", "HR", etc.
      difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        default: "medium",
      },
      questionCount: { type: Number, default: 10 },
    },

    // All questions + answers in this session
    answers: [answerSchema],

    // Session-level summary scores
    summary: {
      averageSemanticScore: { type: Number, default: 0 },
      averageOverallScore: { type: Number, default: 0 },
      averageConfidence: { type: Number, default: null },
      plagiarismFlagged: { type: Number, default: 0 }, // count of flagged answers
      strongAreas: [String],
      weakAreas: [String],
      overallFeedback: { type: String, default: "" },
    },

    // Session lifecycle
    status: {
      type: String,
      enum: ["in_progress", "completed", "abandoned"],
      default: "in_progress",
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    totalDurationSeconds: { type: Number, default: 0 },

    // Phase 1: Candidate intelligence snapshot at session start
    candidateIntelligence: {
      candidateLevel: { type: String, default: null },
      readinessScore: { type: Number, default: null },
      recommendedDifficulty: { type: String, default: null },
      strengths: [String],
      improvementAreas: [String],
    },

    // Phase 1: Question source distribution analytics
    questionSourceDistribution: {
      resume: { type: Number, default: 0 },
      dataset: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("InterviewSession", interviewSessionSchema);
