/**
 * Question Model
 * The question database. Seeded from sample_data/questions.json.
 * Questions are tagged by category, role, company, and difficulty.
 */

const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true,
    },

    // The "gold standard" answer used for semantic evaluation
    ideal_answer: {
      type: String,
      required: true,
    },

    // Important terms that should appear in a good answer
    keywords: [String],

    // Which companies this question is associated with (empty = all)
    company_tags: [String],

    // Which roles this question is associated with
    role_tags: [String],

    // Domain category
    category: {
      type: String,
      required: true,
      enum: [
        "Frontend Development",
        "Backend Development",
        "Python Development",
        "MERN Stack",
        "NLP / AI / ML",
        "Data Structures & Algorithms",
        "DBMS",
        "Operating Systems",
        "HR & Behavioral",
        "System Design Basics",
      ],
    },

    // How to evaluate this type of question
    evaluation_guidelines: { type: String, default: "" },

    // Questions to ask as follow-ups if the answer is strong
    follow_up_questions: [String],
  },
  {
    timestamps: true,
  }
);

// Index for fast filtering by category + difficulty
questionSchema.index({ category: 1, difficulty: 1 });
questionSchema.index({ company_tags: 1 });

module.exports = mongoose.model("Question", questionSchema);
