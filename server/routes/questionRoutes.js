/**
 * Question Routes — GET questions for a given category/difficulty
 */
const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const { protect } = require("../middleware/authMiddleware");
const Question = require("../models/Question");

// GET /api/questions?category=...&difficulty=...&limit=10
router.get("/", protect, asyncHandler(async (req, res) => {
  const { category, difficulty, company, limit = 10 } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (difficulty) filter.difficulty = difficulty;
  if (company) filter.company_tags = company;

  const questions = await Question.find(filter)
    .limit(parseInt(limit))
    .select("question category difficulty keywords company_tags role_tags");

  res.json({ questions, total: questions.length });
}));

// GET /api/questions/categories — list all available categories
router.get("/categories", asyncHandler(async (req, res) => {
  const categories = await Question.distinct("category");
  res.json({ categories });
}));

module.exports = router;
