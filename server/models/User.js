/**
 * User Model
 * Stores account credentials, profile info, and references to resumes.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      // Never return password in query results by default
      select: false,
    },

    // Uploaded resumes (a user can have multiple)
    resumes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Resume",
      },
    ],

    // Quick stats cached for the dashboard
    stats: {
      totalInterviews: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      totalQuestions: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt automatically
  }
);

// ── Password Hashing ────────────────────────────────────────

// Hash the password before saving (only if it was modified)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

// ── Instance Method: Compare passwords ─────────────────────

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ── Instance Method: Return safe user object (no password) ─

userSchema.methods.toSafeObject = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    stats: this.stats,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);
