/**
 * Database Configuration
 * Connects to MongoDB using Mongoose.
 * Simple, reliable, with clear error messages.
 */

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    // Exit process — app cannot run without a database
    process.exit(1);
  }
};

module.exports = connectDB;
