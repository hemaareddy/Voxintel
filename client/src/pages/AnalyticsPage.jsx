/**
 * AnalyticsPage.jsx
 * Full analytics dashboard with:
 *   - Summary stat cards
 *   - Score trend line chart (recharts)
 *   - Category breakdown bar chart
 *   - Weak / strong area tags
 *   - Plagiarism stats
 */

import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import { analyticsAPI } from "../utils/api";
import ScoreRing from "../components/ScoreRing";

// Recharts custom tooltip styled for dark theme
const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
      <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

function getBarColor(score) {
  if (score >= 70) return "var(--green)";
  if (score >= 45) return "var(--accent)";
  return "var(--red)";
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    analyticsAPI.dashboard()
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load analytics."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page"><div className="container">
        <div className="alert alert-error">{error}</div>
      </div></div>
    );
  }

  if (!data || data.totalInterviews === 0) {
    return (
      <div className="page"><div className="container">
        <div className="page-header"><span className="tag">ANALYTICS</span><h1>Your Analytics</h1></div>
        <div className="card" style={{ textAlign: "center", padding: "var(--space-2xl)" }}>
          <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)", opacity: 0.3 }}>📊</div>
          <h4>No data yet</h4>
          <p style={{ marginTop: 8 }}>Complete your first mock interview to see analytics here.</p>
          <a href="/setup" className="btn btn-primary" style={{ marginTop: "var(--space-lg)", display: "inline-block" }}>
            Start an Interview
          </a>
        </div>
      </div></div>
    );
  }

  // Prepare chart data
  const trendData = (data.scoreTrend || []).map((t, i) => ({
    session: `#${i + 1}`,
    score: t.score,
    date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const categoryData = Object.entries(data.categoryBreakdown || {}).map(([cat, score]) => ({
    name: cat.replace("Development", "Dev").replace("& Algorithms", "& Algo"),
    score,
  }));

  return (
    <div className="page">
      <div className="container">

        <div className="page-header animate-fade-in">
          <span className="tag">ANALYTICS</span>
          <h1>Performance Analytics</h1>
          <p style={{ marginTop: 8 }}>Track your progress across all mock interview sessions.</p>
        </div>

        {/* Summary stats */}
        <div className="grid-3 animate-fade-in-1" style={{ marginBottom: "var(--space-xl)" }}>
          <div className="stat-card">
            <div className="stat-value">{data.totalInterviews}</div>
            <div className="stat-label">Total Interviews</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{data.averageScore}</div>
            <div className="stat-label">Average Score</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{data.totalQuestions}</div>
            <div className="stat-label">Questions Answered</div>
          </div>
        </div>

        {/* Score trend + Category breakdown */}
        <div className="grid-2 animate-fade-in-2" style={{ marginBottom: "var(--space-xl)", alignItems: "start" }}>

          {/* Score over time */}
          <div className="card">
            <h4 style={{ marginBottom: "var(--space-lg)" }}>Score Trend</h4>
            {trendData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }} />
                  <Tooltip content={<DarkTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={{ fill: "var(--accent)", r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ fontSize: "0.85rem" }}>Complete at least 2 sessions to see your trend.</p>
            )}
          </div>

          {/* Category breakdown */}
          <div className="card">
            <h4 style={{ marginBottom: "var(--space-lg)" }}>Category Performance</h4>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-mono)" }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-mono)" }} width={100} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="score" name="Score" radius={[0, 4, 4, 0]}>
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={getBarColor(entry.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ fontSize: "0.85rem" }}>No category data yet.</p>
            )}
          </div>
        </div>

        {/* Weak & Strong areas + Plagiarism */}
        <div className="grid-3 animate-fade-in-3" style={{ marginBottom: "var(--space-xl)" }}>

          {/* Strong areas */}
          <div className="card">
            <h4 style={{ marginBottom: "var(--space-md)", color: "var(--green)" }}>✅ Strong Areas</h4>
            {data.strongAreas?.length > 0
              ? data.strongAreas.map((a) => (
                  <div key={a} style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 6, display: "flex", gap: 8 }}>
                    <span style={{ color: "var(--green)" }}>→</span> {a}
                  </div>
                ))
              : <p style={{ fontSize: "0.85rem" }}>Complete more sessions to identify strengths.</p>
            }
          </div>

          {/* Weak areas */}
          <div className="card">
            <h4 style={{ marginBottom: "var(--space-md)", color: "var(--red)" }}>📌 Needs Work</h4>
            {data.weakAreas?.length > 0
              ? data.weakAreas.map((a) => (
                  <div key={a} style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 6, display: "flex", gap: 8 }}>
                    <span style={{ color: "var(--red)" }}>→</span> {a}
                  </div>
                ))
              : <p style={{ fontSize: "0.85rem" }}>No consistently weak areas — great consistency!</p>
            }
          </div>

          {/* Plagiarism stats */}
          <div className="card">
            <h4 style={{ marginBottom: "var(--space-md)" }}>🔍 Originality</h4>
            <div style={{ textAlign: "center", marginBottom: "var(--space-md)" }}>
              <ScoreRing
                score={data.plagiarismStats.total > 0
                  ? Math.round(((data.plagiarismStats.total - data.plagiarismStats.flagged) / data.plagiarismStats.total) * 100)
                  : 100
                }
                size={90}
                label="ORIGINAL"
              />
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center" }}>
              {data.plagiarismStats.flagged} of {data.plagiarismStats.total} answers flagged
            </div>
          </div>
        </div>

        {/* Confidence trend (if available) */}
        {data.confidenceTrend?.length >= 2 && (
          <div className="card animate-fade-in-4" style={{ marginBottom: "var(--space-xl)" }}>
            <h4 style={{ marginBottom: "var(--space-lg)" }}>Confidence Trend</h4>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data.confidenceTrend.map((t, i) => ({
                session: `#${i + 1}`,
                confidence: t.confidenceScore,
                date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }} />
                <Tooltip content={<DarkTooltip />} />
                <Line type="monotone" dataKey="confidence" stroke="var(--blue)" strokeWidth={2} dot={{ fill: "var(--blue)", r: 4 }} name="Confidence" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent sessions table */}
        {data.recentSessions?.length > 0 && (
          <div className="animate-fade-in-4">
            <h3 style={{ marginBottom: "var(--space-md)" }}>Recent Sessions</h3>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                    {["Role", "Company", "Type", "Score", "Questions", "Date"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500, letterSpacing: "0.06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recentSessions.map((s, i) => (
                    <tr key={s._id} style={{ borderBottom: i < data.recentSessions.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <td style={{ padding: "12px 16px", fontSize: "0.88rem", fontWeight: 500 }}>{s.role}</td>
                      <td style={{ padding: "12px 16px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>{s.company}</td>
                      <td style={{ padding: "12px 16px", fontSize: "0.82rem", color: "var(--text-muted)" }}>{s.interviewType}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontWeight: 600, color: getBarColor(s.score) }}>{s.score}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--text-muted)" }}>{s.questionsAnswered}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {new Date(s.date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
