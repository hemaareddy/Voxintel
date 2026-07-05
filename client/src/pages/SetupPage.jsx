/**
 * SetupPage.jsx
 * User selects role, company, interview type, difficulty, and question count
 * before starting a mock interview session.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { interviewAPI, resumeAPI } from "../utils/api";

const ROLES = [
  "Frontend Developer", "Backend Developer", "Full Stack Developer",
  "Python Developer", "Data Scientist", "ML Engineer", "NLP Engineer",
  "Mobile Developer", "DevOps Engineer", "Software Engineer",
];

const COMPANIES = [
  "General", "Google", "Amazon", "Microsoft", "Flipkart",
  "TCS", "Infosys", "Wipro", "Zoho", "Deloitte",
];

const INTERVIEW_TYPES = [
  "Technical Interview", "Frontend Interview", "Backend Interview",
  "Coding Interview", "Coding Round", "AI/ML Interview",
  "System Design Basics", "HR Interview", "Behavioral Interview", "MERN Stack",
];

// Difficulty timing info shown to user
const DIFFICULTY_TIMING = {
  easy:   "5–10 min per question",
  medium: "15–25 min per question",
  hard:   "30–60 min per question",
};

const CODING_TYPES = new Set(["Coding Interview", "Coding Round"]);

const DIFFICULTIES = ["easy", "medium", "hard"];

export default function SetupPage() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [config, setConfig] = useState({
    resumeId: "",
    role: "",
    company: "General",
    interviewType: "",
    difficulty: "medium",
    questionCount: 10,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load user's parsed resumes for selection
  useEffect(() => {
    resumeAPI.list()
      .then((res) => {
        const parsed = res.data.resumes.filter((r) => r.status === "parsed");
        setResumes(parsed);
        if (parsed.length > 0) setConfig((c) => ({ ...c, resumeId: parsed[0]._id }));
      })
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleStart = async () => {
    if (!config.role) return setError("Please select a role.");
    if (!config.interviewType) return setError("Please select an interview type.");

    setLoading(true);
    try {
      const res = await interviewAPI.start({
        ...config,
        questionCount: parseInt(config.questionCount),
      });
      // Navigate to the interview screen, passing session data via location state
      navigate("/interview", { state: { session: res.data } });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to start session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, children }) => (
    <div className="form-group">
      <label>{label}</label>
      {children}
    </div>
  );

  return (
    <div className="page">
      <div className="container-sm">

        <div className="page-header animate-fade-in">
          <span className="tag">SETUP</span>
          <h1>Configure Your Interview</h1>
          <p style={{ marginTop: 8 }}>Tailor the session to match your target role and company.</p>
        </div>

        <div className="card animate-fade-in-1" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>

          {/* Resume selection */}
          <Field label="Resume (optional)">
            <select name="resumeId" value={config.resumeId} onChange={handleChange}>
              <option value="">-- No resume (use general questions) --</option>
              {resumes.map((r) => (
                <option key={r._id} value={r._id}>{r.originalFilename}</option>
              ))}
            </select>
            {resumes.length === 0 && (
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                No parsed resumes found.{" "}
                <a href="/resume">Upload one</a> for skill-matched questions.
              </p>
            )}
          </Field>

          {/* Role */}
          <Field label="Target Role *">
            <select name="role" value={config.role} onChange={handleChange}>
              <option value="">-- Select role --</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>

          {/* Company */}
          <Field label="Target Company">
            <select name="company" value={config.company} onChange={handleChange}>
              {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {config.company !== "General" && (
              <p style={{ fontSize: "0.78rem", color: "var(--accent)", marginTop: 4 }}>
                ✨ Company-specific questions will be prioritized for {config.company}
              </p>
            )}
          </Field>

          {/* Interview type */}
          <Field label="Interview Type *">
            <select name="interviewType" value={config.interviewType} onChange={handleChange}>
              <option value="">-- Select type --</option>
              {INTERVIEW_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {CODING_TYPES.has(config.interviewType) && (
              <p style={{ fontSize: "0.78rem", color: "var(--accent)", marginTop: 4 }}>
                💻 Coding-only mode — all questions will be hands-on programming problems.
              </p>
            )}
          </Field>

          {/* Difficulty + Question count — side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
            <Field label="Difficulty">
              <select name="difficulty" value={config.difficulty} onChange={handleChange}>
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
              {CODING_TYPES.has(config.interviewType) && (
                <p style={{ fontSize: "0.78rem", color: "var(--accent)", marginTop: 4 }}>
                  ⏱ {DIFFICULTY_TIMING[config.difficulty]}
                </p>
              )}
            </Field>

            <Field label="Questions">
              <select name="questionCount" value={config.questionCount} onChange={handleChange}>
                {[5, 8, 10, 15, 20].map((n) => <option key={n} value={n}>{n} questions</option>)}
              </select>
            </Field>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="divider" />

          {/* Summary preview */}
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            <div>$ interview --role "{config.role || "?"}"</div>
            <div style={{ paddingLeft: 16 }}>--company "{config.company}" --type "{config.interviewType || "?"}"</div>
            <div style={{ paddingLeft: 16 }}>--difficulty {config.difficulty} --questions {config.questionCount}</div>
          </div>

          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? (
              <><span className="spinner" style={{ width: 18, height: 18 }} /> Generating questions...</>
            ) : (
              "Start Mock Interview →"
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
