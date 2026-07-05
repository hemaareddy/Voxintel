/**
 * Error Handling Middleware
 * Centralizes all error responses so they have a consistent format.
 */

// Called when no route matches — 404
const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Global error handler — catches errors thrown by any route/controller
const errorHandler = (err, req, res, next) => {
  // If response status is still 200, set to 500
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  // Log the error in development (never log sensitive data)
  if (process.env.NODE_ENV === "development") {
    console.error(`[ERROR] ${err.message}`);
    console.error(err.stack);
  }

  res.status(statusCode).json({
    error: err.message || "An unexpected error occurred",
    // Only include stack trace in development
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
