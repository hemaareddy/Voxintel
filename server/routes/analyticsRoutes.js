/**
 * Analytics Routes
 */
const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const { protect } = require("../middleware/authMiddleware");
const { getDashboard } = require("../controllers/analyticsController");

router.get("/dashboard", protect, asyncHandler(getDashboard));

module.exports = router;
