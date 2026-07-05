/**
 * Auth Middleware
 * Verifies the JWT token on protected routes.
 * Attaches the decoded user ID to req.user.
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  // Tokens are expected in the Authorization header as: "Bearer <token>"
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Extract the token part
      token = req.headers.authorization.split(" ")[1];

      // Verify and decode
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to request (exclude password field)
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({ error: "User not found" });
      }

      next();
    } catch (error) {
      return res.status(401).json({ error: "Not authorized, invalid token" });
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Not authorized, no token provided" });
  }
};

module.exports = { protect };
