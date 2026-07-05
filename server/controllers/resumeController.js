/**
 * Resume Controller
 * Handles resume upload, storage, and triggering of NLP parsing.
 * Deterministic: file saving, DB writes, API calls are predictable.
 * AI-assisted: NLP parsing is delegated to the Python service.
 */

const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const Resume = require("../models/Resume");
const User = require("../models/User");
const pythonNlpClient = require("../services/pythonNlpClient");

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Upload Resume ────────────────────────────────────────────
// POST /api/resume/upload
// Accepts: multipart/form-data with field "resume" (PDF or DOCX)

const uploadResume = async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded. Please upload a PDF or DOCX file.");
  }

  const { originalname, path: tempPath, mimetype } = req.file;

  // Determine file type
  const ext = path.extname(originalname).toLowerCase().replace(".", "");
  if (!["pdf", "docx"].includes(ext)) {
    fs.unlinkSync(tempPath); // clean up the temp file
    res.status(400);
    throw new Error("Only PDF and DOCX files are supported.");
  }

  // Generate a unique filename to prevent collisions
  const storedFilename = `${uuidv4()}.${ext}`;
  const finalPath = path.join(UPLOAD_DIR, storedFilename);

  // Move file from temp location to final location
  fs.renameSync(tempPath, finalPath);

  // Save resume record to DB (status = "uploaded", not yet parsed)
  const resume = await Resume.create({
    user: req.user._id,
    originalFilename: originalname,
    storedFilename: storedFilename,
    fileType: ext,
    status: "uploaded",
  });

  // Add resume reference to user
  await User.findByIdAndUpdate(req.user._id, {
    $push: { resumes: resume._id },
  });

  // Trigger async NLP parsing in the Python service
  // We don't wait for it here — status will update separately
  triggerNLPParsing(resume._id, finalPath, ext);

  res.status(201).json({
    message: "Resume uploaded successfully. Parsing in progress...",
    resumeId: resume._id,
    status: "uploaded",
  });
};

// ── Trigger Python NLP Parsing (async, best-effort) ─────────

const triggerNLPParsing = async (resumeId, filePath, fileType) => {
  try {
    // Update status to processing
    await Resume.findByIdAndUpdate(resumeId, { status: "processing" });

    // Send file to Python NLP service
    const parsed = await pythonNlpClient.parseResume(fs.createReadStream(filePath), fileType);

    // Save parsed data back to MongoDB
    await Resume.findByIdAndUpdate(resumeId, {
      rawText: parsed.raw_text || "",
      parsed: {
        skills: parsed.skills || [],
        technologies: parsed.technologies || [],
        projects: parsed.projects || [],
        education: parsed.education || [],
        certifications: parsed.certifications || [],
        experience: parsed.experience || [],
      },
      // Phase 1: Store intelligence report
      intelligence: parsed.intelligence || {},
      status: "parsed",
    });

    console.log(`✅ Resume ${resumeId} parsed successfully`);
  } catch (error) {
    console.error(`❌ Resume parsing failed for ${resumeId}: ${error.message}`);
    await Resume.findByIdAndUpdate(resumeId, {
      status: "failed",
      parseError: error.message,
    });
  }
};

// ── Get Resume Status ────────────────────────────────────────
// GET /api/resume/:id/status

const getResumeStatus = async (req, res) => {
  const resume = await Resume.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!resume) {
    res.status(404);
    throw new Error("Resume not found");
  }

  res.json({
    status: resume.status,
    parsed: resume.status === "parsed" ? resume.parsed : null,
    parseError: resume.parseError,
  });
};

// ── Get All Resumes for User ─────────────────────────────────
// GET /api/resume/

const getMyResumes = async (req, res) => {
  const resumes = await Resume.find({ user: req.user._id })
    .select("originalFilename status createdAt parsed.skills")
    .sort({ createdAt: -1 });

  res.json({ resumes });
};

// ── Get Resume Intelligence Insights ────────────────────────
// GET /api/resume/:id/insights

const getResumeInsights = async (req, res) => {
  const resume = await Resume.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!resume) {
    res.status(404);
    throw new Error("Resume not found");
  }

  if (resume.status !== "parsed") {
    res.status(400);
    throw new Error(`Resume is not yet parsed (status: ${resume.status})`);
  }

  // If intelligence was not generated during parsing (e.g. older resumes),
  // call Python to generate it now and cache it.
  if (!resume.intelligence || resume.intelligence.readinessScore === null) {
    try {
      const intelligence = await pythonNlpClient.analyzeIntelligence(resume.parsed);

      await Resume.findByIdAndUpdate(resume._id, { intelligence });
      return res.json(intelligence);
    } catch (err) {
      console.error(`Intelligence generation failed: ${err.message}`);
      res.status(500);
      throw new Error("Could not generate resume intelligence");
    }
  }

  res.json(resume.intelligence);
};

module.exports = { uploadResume, getResumeStatus, getMyResumes, getResumeInsights };
