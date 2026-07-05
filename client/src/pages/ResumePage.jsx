/**
 * ResumePage.jsx
 * Upload a PDF/DOCX resume and display parsed skills, projects, and education.
 * Polls the server until parsing is complete.
 */

import React, { useState, useEffect, useRef } from "react";
import { resumeAPI } from "../utils/api";

export default function ResumePage() {
  const [resumes, setResumes] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [selectedResume, setSelectedResume] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [pollingId, setPollingId] = useState(null);
  const [dragover, setDragover] = useState(false);
  const fileInputRef = useRef();

  // Load existing resumes on mount
  useEffect(() => {
    resumeAPI.list().then((res) => setResumes(res.data.resumes)).catch(() => {});
  }, []);

  // Poll resume parse status until complete
  const pollStatus = (resumeId) => {
    const interval = setInterval(async () => {
      try {
        const res = await resumeAPI.status(resumeId);
        const { status, parsed } = res.data;

        if (status === "parsed") {
          clearInterval(interval);
          setParsedData(parsed);
          // Load intelligence report
          resumeAPI.insights(resumeId)
            .then((r) => setIntelligence(r.data))
            .catch(() => {});
          // Refresh resume list
          resumeAPI.list().then((r) => setResumes(r.data.resumes));
        } else if (status === "failed") {
          clearInterval(interval);
          setUploadError("Resume parsing failed. Please try a different file.");
        }
        // If still "processing", keep polling
      } catch {
        clearInterval(interval);
      }
    }, 2000); // check every 2 seconds

    setPollingId(interval);
    return () => clearInterval(interval);
  };

  // Clean up polling on unmount
  useEffect(() => () => { if (pollingId) clearInterval(pollingId); }, [pollingId]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploadError("");
    setParsedData(null);

    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx"].includes(ext)) {
      setUploadError("Only PDF and DOCX files are supported.");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    setUploading(true);
    try {
      const res = await resumeAPI.upload(formData);
      setSelectedResume(res.data.resumeId);
      pollStatus(res.data.resumeId);
    } catch (err) {
      setUploadError(err.response?.data?.error || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const onFileInput = (e) => handleUpload(e.target.files[0]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    handleUpload(e.dataTransfer.files[0]);
  };

  const loadResumeDetails = async (id) => {
    setSelectedResume(id);
    setParsedData(null);
    setIntelligence(null);
    try {
      const res = await resumeAPI.status(id);
      if (res.data.parsed) {
        setParsedData(res.data.parsed);
        // Also load intelligence
        resumeAPI.insights(id)
          .then((r) => setIntelligence(r.data))
          .catch(() => {});
      }
    } catch {}
  };

  return (
    <div className="page">
      <div className="container">

        <div className="page-header animate-fade-in">
          <span className="tag">RESUME</span>
          <h1>Resume Analysis</h1>
          <p style={{ marginTop: 8 }}>Upload your resume to extract skills and personalize your interview questions.</p>
        </div>

        <div className="grid-2" style={{ alignItems: "start" }}>

          {/* Upload zone */}
          <div className="animate-fade-in-1">
            <div
              className={`upload-zone ${dragover ? "dragover" : ""}`}
              onClick={() => fileInputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
              onDragLeave={() => setDragover(false)}
              onDrop={onDrop}
            >
              <span className="upload-icon">📄</span>
              <h4>Drop your resume here</h4>
              <p style={{ marginTop: 8, fontSize: "0.85rem" }}>PDF or DOCX · Max 10 MB</p>
              <button
                className="btn btn-outline btn-sm"
                style={{ marginTop: "var(--space-md)", pointerEvents: "none" }}
              >
                Browse files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={onFileInput}
                style={{ display: "none" }}
              />
            </div>

            {uploadError && (
              <div className="alert alert-error" style={{ marginTop: "var(--space-md)" }}>{uploadError}</div>
            )}

            {uploading && (
              <div className="alert alert-info" style={{ marginTop: "var(--space-md)", display: "flex", gap: 10, alignItems: "center" }}>
                <span className="spinner" style={{ width: 16, height: 16 }} />
                Uploading and processing your resume...
              </div>
            )}

            {selectedResume && !uploading && !parsedData && (
              <div className="alert alert-warn" style={{ marginTop: "var(--space-md)", display: "flex", gap: 10, alignItems: "center" }}>
                <span className="pulse">⏳</span>
                NLP analysis in progress — this takes ~10-20 seconds...
              </div>
            )}

            {/* Previous resumes */}
            {resumes.length > 0 && (
              <div style={{ marginTop: "var(--space-xl)" }}>
                <h4 style={{ marginBottom: "var(--space-md)" }}>Previous Uploads</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                  {resumes.map((r) => (
                    <div
                      key={r._id}
                      className="card"
                      style={{
                        cursor: "pointer",
                        padding: "var(--space-md)",
                        borderColor: selectedResume === r._id ? "var(--accent)" : undefined,
                      }}
                      onClick={() => loadResumeDetails(r._id)}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--space-sm)" }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>{r.originalFilename}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                            {new Date(r.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <span className={`badge ${r.status === "parsed" ? "badge-green" : r.status === "failed" ? "badge-red" : "badge-amber"}`}>
                          {r.status}
                        </span>
                      </div>
                      {r["parsed.skills"]?.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {r["parsed.skills"].slice(0, 5).join(", ")}...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Parsed results panel */}
          <div className="animate-fade-in-2">
            {parsedData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                <div className="alert alert-success">✅ Resume parsed successfully</div>

                {/* ── Phase 1: Intelligence Panel ── */}
                {intelligence && (
                  <div className="card" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.06) 100%)", borderColor: "var(--accent)" }}>
                    <h4 style={{ marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: 8 }}>
                      🧠 Candidate Intelligence
                    </h4>

                    {/* Level + Difficulty row */}
                    <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap", marginBottom: "var(--space-md)" }}>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Candidate Level</div>
                        <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{intelligence.candidateLevel}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recommended Difficulty</div>
                        <span className={`badge ${
                          intelligence.recommendedDifficulty === "Expert" ? "badge-red" :
                          intelligence.recommendedDifficulty === "Advanced" ? "badge-amber" :
                          intelligence.recommendedDifficulty === "Intermediate" ? "badge-blue" : "badge-green"
                        }`} style={{ fontSize: "0.85rem" }}>
                          {intelligence.recommendedDifficulty}
                        </span>
                      </div>
                    </div>

                    {/* Readiness Score bar */}
                    <div style={{ marginBottom: "var(--space-md)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Readiness Score</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", fontWeight: 700 }}>{intelligence.readinessScore}/100</span>
                      </div>
                      <div style={{ height: 8, background: "var(--surface)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${intelligence.readinessScore}%`,
                          background: intelligence.readinessScore >= 70 ? "var(--success)" : intelligence.readinessScore >= 40 ? "var(--warning)" : "var(--error)",
                          borderRadius: 4,
                          transition: "width 0.8s ease"
                        }} />
                      </div>
                    </div>

                    {/* Skill / Exp / Project strength bars */}
                    {[
                      { label: "Skill Strength", value: intelligence.skillStrength },
                      { label: "Experience", value: intelligence.experienceStrength },
                      { label: "Projects", value: intelligence.projectStrength },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ marginBottom: "var(--space-sm)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{label}</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{value}</span>
                        </div>
                        <div style={{ height: 5, background: "var(--surface)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${value}%`, background: "var(--accent)", borderRadius: 3, opacity: 0.7 }} />
                        </div>
                      </div>
                    ))}

                    {/* Strengths */}
                    {intelligence.strengths?.length > 0 && (
                      <div style={{ marginTop: "var(--space-md)" }}>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6 }}>💪 Strengths</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {intelligence.strengths.map((s) => (
                            <span key={s} className="badge badge-green" style={{ fontSize: "0.78rem" }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Improvement Areas */}
                    {intelligence.improvementAreas?.length > 0 && (
                      <div style={{ marginTop: "var(--space-md)" }}>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6 }}>🎯 Areas to Improve</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {intelligence.improvementAreas.map((a) => (
                            <span key={a} className="badge badge-amber" style={{ fontSize: "0.78rem" }}>{a}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="card">
                  <h4 style={{ marginBottom: "var(--space-md)" }}>🛠️ Skills Detected</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {parsedData.skills?.length > 0
                      ? parsedData.skills.map((s) => (
                          <span key={s} className="badge badge-amber">{s}</span>
                        ))
                      : <p style={{ fontSize: "0.85rem" }}>No skills detected. Try a more detailed resume.</p>
                    }
                  </div>
                </div>

                {/* Technologies */}
                {parsedData.technologies?.length > 0 && (
                  <div className="card">
                    <h4 style={{ marginBottom: "var(--space-md)" }}>⚙️ Technologies</h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {parsedData.technologies.map((t) => (
                        <span key={t} className="badge badge-blue">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Projects */}
                {parsedData.projects?.length > 0 && (
                  <div className="card">
                    <h4 style={{ marginBottom: "var(--space-md)" }}>📁 Projects Found</h4>
                    {parsedData.projects.map((p, i) => (
                      <div key={i} style={{ marginBottom: "var(--space-md)", paddingBottom: "var(--space-md)", borderBottom: i < parsedData.projects.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{p.name}</div>
                        {p.description && <p style={{ fontSize: "0.82rem", marginTop: 4 }}>{p.description.slice(0, 150)}</p>}
                        {p.technologies?.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                            {p.technologies.map((t) => <span key={t} className="badge badge-gray">{t}</span>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Education */}
                {parsedData.education?.length > 0 && (
                  <div className="card">
                    <h4 style={{ marginBottom: "var(--space-md)" }}>🎓 Education</h4>
                    {parsedData.education.map((e, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: "0.88rem" }}>{e.degree}</span>
                        {e.year && <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-muted)" }}>{e.year}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="card" style={{ textAlign: "center", padding: "var(--space-2xl)", border: "1px dashed var(--border)" }}>
                <div style={{ fontSize: "2.5rem", opacity: 0.3, marginBottom: "var(--space-md)" }}>🔍</div>
                <p>Upload a resume to see extracted skills, projects, and education here.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
