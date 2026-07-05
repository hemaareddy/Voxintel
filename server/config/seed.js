/**
 * Database Seeder
 * Seeds the question database from sample_data/questions.json
 * Run with: npm run seed
 */

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../.env") });

const Question = require("../models/Question");
const User = require("../models/User");
const InterviewSession = require("../models/InterviewSession");

const seed = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/voxintel");
    console.log("✅ Connected to MongoDB");

    // ── Step 1: Seed Questions ──────────────────────────────
    const questionsPath = path.join(__dirname, "../../sample_data/questions.json");
    const questions = JSON.parse(fs.readFileSync(questionsPath, "utf8"));

    await Question.deleteMany({});
    console.log("🗑️  Cleared existing questions");

    await Question.insertMany(questions);
    console.log(`✅ Seeded ${questions.length} questions`);

    // ── Step 2: Create Demo User ────────────────────────────
    let demoUser = await User.findOne({ email: "demo@voxintel.com" });
    if (!demoUser) {
      demoUser = await User.create({
        name: "Demo User",
        email: "demo@voxintel.com",
        password: "demo1234",
      });
      console.log("✅ Demo user created: demo@voxintel.com / demo1234");
    } else {
      console.log("ℹ️  Demo user already exists");
    }

    // ── Step 3: Seed Sample Sessions ───────────────────────
    // Clear old demo sessions to avoid duplicates on re-seed
    await InterviewSession.deleteMany({ user: demoUser._id });

    // Load sample session from JSON
    const samplePath = path.join(__dirname, "../../sample_data/sample_session.json");
    const sampleData = JSON.parse(fs.readFileSync(samplePath, "utf8"));

    // Session 1 — Google / Technical Interview (2 days ago)
    await InterviewSession.create({
      user: demoUser._id,
      resume: null,
      config: sampleData.config,
      answers: sampleData.answers.map((a) => ({
        questionId: new mongoose.Types.ObjectId().toString(),
        question: a.question,
        category: a.category,
        difficulty: a.difficulty,
        userAnswer: a.userAnswer,
        answerMode: a.answerMode,
        timeTakenSeconds: a.timeTakenSeconds,
        scores: a.scores,
        confidence: a.confidence,
        plagiarism: a.plagiarism,
        feedback: a.feedback,
      })),
      summary: sampleData.summary,
      status: "completed",
      startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 48 * 60 * 60 * 1000 + 25 * 60 * 1000),
    });

    // Session 2 — Amazon / Python (1 day ago, simpler)
    await InterviewSession.create({
      user: demoUser._id,
      resume: null,
      config: {
        role: "Python Developer",
        company: "Amazon",
        interviewType: "Coding Round",
        difficulty: "easy",
        questionCount: 3,
      },
      answers: [
        {
          questionId: new mongoose.Types.ObjectId().toString(),
          question: "What is the difference between a list and a tuple in Python?",
          category: "Python Development",
          difficulty: "easy",
          userAnswer: "Lists are mutable sequences while tuples are immutable. You can add or remove items from a list but not a tuple. Tuples are slightly faster and can be used as dictionary keys since they are hashable.",
          answerMode: "text",
          timeTakenSeconds: 35,
          scores: { semantic: 80, keyword: 75, completeness: 72, overall: 76 },
          confidence: { score: 72, filler_word_count: 0, speech_speed: "normal", feedback: "Clear and direct." },
          plagiarism: { score: 4, ai_score: 6, is_original: true, feedback: "Appears original." },
          feedback: "Good answer covering the key mutable vs immutable distinction.",
        },
        {
          questionId: new mongoose.Types.ObjectId().toString(),
          question: "What are Python decorators?",
          category: "Python Development",
          difficulty: "medium",
          userAnswer: "Decorators are functions that wrap other functions to add behavior without modifying the original. They use the @ syntax. Examples include @login_required or @staticmethod.",
          answerMode: "text",
          timeTakenSeconds: 42,
          scores: { semantic: 74, keyword: 68, completeness: 65, overall: 70 },
          confidence: { score: 68, filler_word_count: 1, speech_speed: "normal", feedback: "Good but could be more detailed." },
          plagiarism: { score: 7, ai_score: 10, is_original: true, feedback: "Appears original." },
          feedback: "Good overview. Try explaining HOW they work using higher-order functions.",
        },
        {
          questionId: new mongoose.Types.ObjectId().toString(),
          question: "Explain Python generators.",
          category: "Python Development",
          difficulty: "medium",
          userAnswer: "Generators use yield instead of return and produce values lazily one at a time. They are memory efficient because they don't load everything into memory upfront.",
          answerMode: "text",
          timeTakenSeconds: 40,
          scores: { semantic: 82, keyword: 78, completeness: 71, overall: 78 },
          confidence: { score: 74, filler_word_count: 0, speech_speed: "normal", feedback: "Confident and clear." },
          plagiarism: { score: 6, ai_score: 8, is_original: true, feedback: "Appears original." },
          feedback: "Solid answer. Add a code example to make it more concrete.",
        },
      ],
      summary: {
        averageSemanticScore: 79,
        averageOverallScore: 75,
        averageConfidence: 71,
        plagiarismFlagged: 0,
        strongAreas: ["Python Development"],
        weakAreas: [],
        overallFeedback: "Good effort! You have a solid grasp of Python fundamentals.",
      },
      status: "completed",
      startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
    });

    console.log("✅ 2 sample sessions seeded");

    // ── Step 4: Update demo user stats ──────────────────────
    await User.findByIdAndUpdate(demoUser._id, {
      "stats.totalInterviews": 2,
      "stats.averageScore": 76,
      "stats.totalQuestions": 8,
    });

    // ── Done ────────────────────────────────────────────────
    console.log("\n" + "─".repeat(48));
    console.log("🎙️  VoxIntel database seeded successfully!");
    console.log("─".repeat(48));
    console.log(`   Questions  → ${questions.length} loaded`);
    console.log("   Demo user  → demo@voxintel.com / demo1234");
    console.log("   Sessions   → 2 sample sessions created");
    console.log("─".repeat(48) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

seed();
