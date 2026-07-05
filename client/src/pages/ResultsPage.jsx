/**
 * ResultsPage.jsx
 * Post-interview results screen.
 * Shows overall score, score breakdown, strong/weak areas, and session feedback.
 */

import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { interviewAPI } from "../utils/api";
import ScoreRing from "../components/ScoreRing";
import ProgressBar from "../components/ProgressBar";

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const summary = location.state?.summary;
  const sessionId = location.state?.sessionId;

  const [session, setSession] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Load detailed per-question breakdown
  const loadDetails = async () => {
    if (session || !sessionId) return;
    setLoadingDetails(true);
    try {
      const res = await interviewAPI.getSession(sessionId);
      setSession(res.data.session);
      setShowDetails(true);
    } catch {
      setShowDetails(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (!summary) {
    return (
      <div className="page-center">
        <div style={{ textAlign: "center" }}>
          <p>No results found.</p>
          <Link to="/setup" className="btn btn-primary" style={{ marginTop: 16 }}>Start an interview</Link>
        </div>
      </div>
    );
  }

  const overallScore = summary.averageOverallScore || 0;
  const semanticScore = summary.averageSemanticScore || 0;

  const scoreColor = overallScore >= 70 ? "var(--green)" : overallScore >= 45 ? "var(--accent)" : "var(--red)";
  const scoreLabel = overallScore >= 80 ? "Excellent" : overallScore >= 65 ? "Good" : overallScore >= 45 ? "Fair" : "Needs Work";

  return (
    <div className="page">
      <div className="container-sm">

        {/* Header */}
        <div className="page-header animate-fade-in" style={{ textAlign: "center" }}>
          <span className="tag">RESULTS</span>
          <h1>Interview Complete</h1>
        </div>

        {/* Hero score */}
        <div className="card animate-fade-in-1" style={{ textAlign: "center", padding: "var(--space-xl)", marginBottom: "var(--space-lg)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-lg)" }}>
            <ScoreRing score={overallScore} size={140} label="OVERALL" />
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: scoreColor }}>
            {scoreLabel}
          </div>
          <p style={{ marginTop: 8 }}>
            You answered {session?.answers?.filter((a) => a.userAnswer)?.length ?? "—"} questions
            {summary.plagiarismFlagged > 0 && (
              <> · <span style={{ color: "var(--red)" }}>{summary.plagiarismFlagged} originality flags</span></>
            )}
          </p>
        </div>

        {/* Score breakdown */}
        <div className="card animate-fade-in-2" style={{ marginBottom: "var(--space-lg)" }}>
          <h4 style={{ marginBottom: "var(--space-md)" }}>Score Breakdown</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <ProgressBar label="Semantic Understanding" score={semanticScore} />
            <ProgressBar label="Overall Score" score={overallScore} />
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid-2 animate-fade-in-3" style={{ marginBottom: "var(--space-lg)" }}>
          <div className="card">
            <h4 style={{ marginBottom: "var(--space-md)", color: "var(--green)" }}>✅ Strong Areas</h4>
            {summary.strongAreas?.length > 0
              ? summary.strongAreas.map((a) => (
                  <div key={a} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: "var(--green)", fontSize: "0.7rem" }}>●</span>
                    <span style={{ fontSize: "0.88rem" }}>{a}</span>
                  </div>
                ))
              : <p style={{ fontSize: "0.85rem" }}>Keep practicing to build strong areas!</p>
            }
          </div>
          <div className="card">
            <h4 style={{ marginBottom: "var(--space-md)", color: "var(--red)" }}>📌 Weak Areas</h4>
            {summary.weakAreas?.length > 0
              ? summary.weakAreas.map((a) => (
                  <div key={a} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: "var(--red)", fontSize: "0.7rem" }}>●</span>
                    <span style={{ fontSize: "0.88rem" }}>{a}</span>
                  </div>
                ))
              : <p style={{ fontSize: "0.85rem" }}>No weak areas identified — great job!</p>
            }
          </div>
        </div>

        {/* Overall feedback */}
        {summary.overallFeedback && (
          <div className="card card-accent animate-fade-in-4" style={{ marginBottom: "var(--space-lg)" }}>
            <h4 style={{ marginBottom: "var(--space-md)" }}>💬 Session Feedback</h4>
            <p>{summary.overallFeedback}</p>
          </div>
        )}

        {/* Per-question details toggle */}
        {sessionId && (
          <div className="animate-fade-in-4" style={{ marginBottom: "var(--space-xl)" }}>
            {!showDetails ? (
              <button
                className="btn btn-outline btn-block"
                onClick={loadDetails}
                disabled={loadingDetails}
              >
                {loadingDetails
                  ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Loading...</>
                  : "View Per-Question Breakdown"
                }
              </button>
            ) : (
              <div>
                <h3 style={{ marginBottom: "var(--space-md)" }}>Question Breakdown</h3>
                {session?.answers?.filter((a) => a.userAnswer).map((ans, i) => (
                  <div key={i} className="card" style={{ marginBottom: "var(--space-md)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-md)" }}>
                      <div style={{ flex: 1, paddingRight: "var(--space-md)" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4 }}>
                          Q{i + 1} · {ans.category}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>{ans.question}</div>
                      </div>
                      <ScoreRing score={ans.scores?.overall || 0} size={60} />
                    </div>

                    {/* Answer given */}
                    <div style={{ background: "var(--bg-elevated)", padding: "var(--space-md)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-md)" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>YOUR ANSWER</div>
                      <p style={{ fontSize: "0.85rem" }}>{ans.userAnswer}</p>
                    </div>

                    {/* Mini scores */}
                    <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap", marginBottom: "var(--space-md)" }}>
                      {[
                        { label: "Semantic", val: ans.scores?.semantic },
                        { label: "Keywords", val: ans.scores?.keyword },
                        { label: "Depth", val: ans.scores?.completeness },
                      ].map(({ label, val }) => (
                        <div key={label} style={{ textAlign: "center", minWidth: 60 }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{val ?? "—"}</div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--text-muted)" }}>{label}</div>
                        </div>
                      ))}
                      {ans.confidence?.score !== null && ans.confidence?.score !== undefined && (
                        <div style={{ textAlign: "center", minWidth: 60 }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{ans.confidence.score}</div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--text-muted)" }}>Confidence</div>
                        </div>
                      )}
                    </div>

                    {/* Feedback */}
                    {ans.feedback && (
                      <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        {ans.feedback.split("\n\n")[0]} {/* show just first paragraph */}
                      </p>
                    )}

                    {/* Plagiarism flag */}
                    {ans.plagiarism && !ans.plagiarism.isOriginal && (
                      <div className="badge badge-red" style={{ marginTop: 8, display: "inline-flex" }}>
                        ⚠ Originality flagged
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
          <Link to="/setup" className="btn btn-primary btn-lg" style={{ flex: 1 }}>
            Practice Again →
          </Link>
          <Link to="/analytics" className="btn btn-outline btn-lg" style={{ flex: 1 }}>
            View Analytics
          </Link>
        </div>

      </div>
    </div>
  );
}
