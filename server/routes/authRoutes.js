/**
 * Auth Routes
 * POST /api/auth/register — create account
 * POST /api/auth/login    — sign in
 * GET  /api/auth/me       — get current user (protected)
 */

const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const { register, login, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.get("/me", protect, asyncHandler(getMe));

module.exports = router;
