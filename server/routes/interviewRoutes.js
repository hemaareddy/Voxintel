/**
 * Interview Routes
 */
const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const { protect } = require("../middleware/authMiddleware");
const { startSession, getSession, getHistory } = require("../controllers/interview/sessionController");
const { submitAnswer } = require("../controllers/interview/answerController");
const { completeSession } = require("../controllers/interview/completionController");

router.post("/start", protect, asyncHandler(startSession));
router.post("/answer", protect, asyncHandler(submitAnswer));
router.post("/complete", protect, asyncHandler(completeSession));
router.get("/history", protect, asyncHandler(getHistory));
router.get("/:sessionId", protect, asyncHandler(getSession));

module.exports = router;
