/**
 * Auth Controller
 * Handles user registration and login.
 * Uses JWT for stateless authentication.
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ── Helper: Generate a signed JWT token ─────────────────────

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// ── Register ─────────────────────────────────────────────────
// POST /api/auth/register
// Body: { name, email, password }

const register = async (req, res) => {
  const { name, email, password } = req.body;

  // Basic validation
  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please provide name, email, and password");
  }

  // Check if email is already registered
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    res.status(400);
    throw new Error("An account with this email already exists");
  }

  // Create the user (password hashing happens in the model's pre-save hook)
  const user = await User.create({ name, email, password });

  res.status(201).json({
    message: "Account created successfully",
    user: user.toSafeObject(),
    token: generateToken(user._id),
  });
};

// ── Login ────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  // Find user — must explicitly select password since it's select:false in model
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  // Compare submitted password with stored hash
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  res.json({
    message: "Login successful",
    user: user.toSafeObject(),
    token: generateToken(user._id),
  });
};

// ── Get Current User ─────────────────────────────────────────
// GET /api/auth/me (protected)

const getMe = async (req, res) => {
  // req.user is attached by the protect middleware
  res.json({ user: req.user.toSafeObject() });
};

module.exports = { register, login, getMe };
