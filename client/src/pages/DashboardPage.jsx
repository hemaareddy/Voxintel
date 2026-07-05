/**
 * DashboardPage.jsx
 * Landing page after login. Shows user stats and quick links to start practicing.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { analyticsAPI } from "../utils/api";
import { useAuth } from "../utils/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.dashboard()
      .then((res) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="page-header animate-fade-in">
          <span className="tag">DASHBOARD</span>
          <h1>Welcome back, {user?.name?.split(" ")[0]}</h1>
          <p style={{ marginTop: 8 }}>Ready to sharpen your interview skills?</p>
        </div>

        {/* Quick action cards */}
        <div className="grid-3 animate-fade-in-1" style={{ marginBottom: "var(--space-xl)" }}>
          <Link to="/resume" style={{ textDecoration: "none" }}>
            <div className="card" style={{ cursor: "pointer", transition: "border-color 0.18s" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>📄</div>
              <h4>Upload Resume</h4>
              <p style={{ fontSize: "0.85rem", marginTop: 4 }}>Parse your skills and tailor questions</p>
            </div>
          </Link>

          <Link to="/setup" style={{ textDecoration: "none" }}>
            <div className="card card-accent" style={{ cursor: "pointer" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>🎙️</div>
              <h4>Start Interview</h4>
              <p style={{ fontSize: "0.85rem", marginTop: 4 }}>Pick role, company, and difficulty</p>
            </div>
          </Link>

          <Link to="/analytics" style={{ textDecoration: "none" }}>
            <div className="card" style={{ cursor: "pointer" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>📊</div>
              <h4>View Analytics</h4>
              <p style={{ fontSize: "0.85rem", marginTop: 4 }}>Track your score and confidence trends</p>
            </div>
          </Link>
        </div>

        {/* Stats row */}
        {loading ? (
          <div className="flex items-center gap-md" style={{ color: "var(--text-muted)" }}>
            <div className="spinner" /> Loading stats...
          </div>
        ) : stats && stats.totalInterviews > 0 ? (
          <div className="animate-fade-in-2">
            <h3 style={{ marginBottom: "var(--space-md)" }}>Your Performance</h3>
            <div className="grid-3" style={{ marginBottom: "var(--space-xl)" }}>
              <div className="stat-card">
                <div className="stat-value">{stats.totalInterviews}</div>
                <div className="stat-label">Interviews Done</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.averageScore}</div>
                <div className="stat-label">Average Score</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalQuestions}</div>
                <div className="stat-label">Questions Answered</div>
              </div>
            </div>

            {/* Recent sessions */}
            {stats.recentSessions?.length > 0 && (
              <div>
                <h3 style={{ marginBottom: "var(--space-md)" }}>Recent Sessions</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                  {stats.recentSessions.map((s) => (
                    <div key={s._id} className="card" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--space-sm)", padding: "var(--space-md)" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{s.role} — {s.company}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                          {s.interviewType} · {new Date(s.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "var(--font-mono)", color: s.score >= 70 ? "var(--green)" : s.score >= 45 ? "var(--accent)" : "var(--red)", fontWeight: 600 }}>
                          {s.score}/100
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{s.questionsAnswered} questions</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card alert-info animate-fade-in-2" style={{ textAlign: "center", padding: "var(--space-xl)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "var(--space-md)" }}>🚀</div>
            <h4>No sessions yet</h4>
            <p style={{ marginTop: 8, marginBottom: "var(--space-md)" }}>Upload your resume and start your first mock interview</p>
            <Link to="/setup" className="btn btn-primary">Start practicing →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
