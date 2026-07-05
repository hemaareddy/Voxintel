/**
 * InterviewSession Model
 * Tracks a complete mock interview: questions asked, answers given,
 * evaluation scores, and session-level analytics.
 */

const mongoose = require("mongoose");

// ── Sub-schema: A single question + answer pair ─────────────

const answerSchema = new mongoose.Schema({
  questionId: { type: String },
  question: { type: String, required: true },
  category: { type: String },
  difficulty: { type: String },

  // The user's submitted answer
  userAnswer: { type: String, default: "" },
  answerMode: { type: String, enum: ["text", "voice"], default: "text" },
  timeTakenSeconds: { type: Number, default: 0 },

  // Scores from the Python NLP evaluation service
  scores: {
    semantic: { type: Number, default: 0 },      // 0-100: meaning similarity
    keyword: { type: Number, default: 0 },        // 0-100: technical terms used
    completeness: { type: Number, default: 0 },   // 0-100: answer depth
    overall: { type: Number, default: 0 },        // weighted composite
  },

  // Confidence analysis (if voice input was used)
  confidence: {
    score: { type: Number, default: null },
    fillerWordCount: { type: Number, default: 0 },
    speechSpeed: { type: String, default: null }, // "slow" | "normal" | "fast"
    feedback: { type: String, default: null },
  },

  // Plagiarism / AI detection results
  plagiarism: {
    score: { type: Number, default: 0 },    // 0-100: how plagiarised
    aiScore: { type: Number, default: 0 },  // 0-100: likelihood AI-generated
    isOriginal: { type: Boolean, default: true },
    feedback: { type: String, default: null },
  },

  // Personalized feedback text
  feedback: { type: String, default: "" },

  // Whether the system asked a follow-up (adaptive flow)
  hadFollowUp: { type: Boolean, default: false },

  // Phase 1: Question source tracking
  source: { type: String, enum: ["resume", "dataset", "generated"], default: "dataset" },
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
