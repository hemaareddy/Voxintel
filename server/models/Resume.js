/**
 * Resume Model
 * Stores parsed resume data: skills, projects, education, etc.
 * The raw text and NLP-extracted fields are stored here.
 */

const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Original file info
    originalFilename: { type: String, required: true },
    storedFilename: { type: String, required: true }, // on-disk name (UUID-based)
    fileType: { type: String, enum: ["pdf", "docx"], required: true },

    // Raw extracted text from the resume file
    rawText: { type: String, default: "" },

    // NLP-extracted structured data (filled by Python service)
    parsed: {
      skills: [String],          // e.g. ["React", "Node.js", "Python"]
      technologies: [String],    // e.g. ["MongoDB", "Docker"]
      projects: [                // list of project summaries
        {
          name: String,
          description: String,
          technologies: [String],
        },
      ],
      education: [
        {
          degree: String,
          institution: String,
          year: String,
        },
      ],
      certifications: [String],
      experience: [
        {
          role: String,
          company: String,
          duration: String,
        },
      ],
    },

    // Processing status
    status: {
      type: String,
      enum: ["uploaded", "processing", "parsed", "failed"],
      default: "uploaded",
    },
    parseError: { type: String, default: null },

    // Phase 1: Resume Intelligence (populated after parsing)
    intelligence: {
      candidateLevel: {
        type: String,
        enum: ["Beginner", "Junior", "Intermediate", "Advanced", "Senior"],
        default: null,
      },
      skillStrength: { type: Number, default: null },
      experienceStrength: { type: Number, default: null },
      projectStrength: { type: Number, default: null },
      readinessScore: { type: Number, default: null },
      recommendedDifficulty: {
        type: String,
        enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
        default: null,
      },
      strengths: [String],
      improvementAreas: [String],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Resume", resumeSchema);
