/**
 * Resume Routes
 * POST /api/resume/upload      — upload a resume file
 * GET  /api/resume/            — list user's resumes
 * GET  /api/resume/:id/status  — check parsing status
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const asyncHandler = require("express-async-handler");
const { protect } = require("../middleware/authMiddleware");
const { uploadResume, getResumeStatus, getMyResumes, getResumeInsights } = require("../controllers/resumeController");

// Configure multer — stores files temporarily before we move them
const upload = multer({
  dest: path.join(__dirname, "../../uploads/temp"),
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are accepted"), false);
    }
  },
});

router.post("/upload", protect, upload.single("resume"), asyncHandler(uploadResume));
router.get("/", protect, asyncHandler(getMyResumes));
router.get("/:id/status", protect, asyncHandler(getResumeStatus));
router.get("/:id/insights", protect, asyncHandler(getResumeInsights));

module.exports = router;
