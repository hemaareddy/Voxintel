/**
 * LandingPage.jsx
 * Public-facing marketing page for VoxIntel.
 * Shown to unauthenticated visitors at "/".
 * Design: Soft SaaS — clean gradients, glassmorphism cards, subtle animations.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

/* ── Animated counter hook ─────────────────────────────── */
function useCounter(target, duration = 1500) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

/* ── Feature card data ─────────────────────────────────── */
const FEATURES = [
  {
    icon: "🧠",
    title: "AI-Powered Questions",
    desc: "Resume-tailored questions generated from your real projects and skills — not generic templates.",
    color: "#5b6cf9",
    bg: "#eef0ff",
  },
  {
    icon: "💻",
    title: "Coding Rounds",
    desc: "Focused coding challenges with dynamic difficulty timing — 5 min for easy, up to 60 min for hard.",
    color: "#8b5cf6",
    bg: "#f3e8ff",
  },
  {
    icon: "📄",
    title: "Smart Resume Parser",
    desc: "Extracts skills, projects, education, and experience with OCR fallback for scanned PDFs.",
    color: "#3b82f6",
    bg: "#dbeafe",
  },
  {
    icon: "📊",
    title: "Deep Analytics",
    desc: "Track scores, confidence, answer quality, and progress over every session you complete.",
    color: "#10b981",
    bg: "#d1fae5",
  },
  {
    icon: "🛡️",
    title: "Integrity Detection",
    desc: "Language-aware plagiarism checks filter false positives and only flag genuinely suspicious submissions.",
    color: "#f59e0b",
    bg: "#fef3c7",
  },
  {
    icon: "🎯",
    title: "Company-Specific Prep",
    desc: "Tailored question styles for Google, Amazon, Flipkart, TCS, Zoho, and more top companies.",
    color: "#ef4444",
    bg: "#fee2e2",
  },
];

/* ── Workflow steps ────────────────────────────────────── */
const STEPS = [
  { num: "01", title: "Upload Your Resume", desc: "Drop in your PDF or DOCX — we extract skills, projects, and experience automatically." },
  { num: "02", title: "Configure Your Session", desc: "Choose role, company, interview type (Technical / Coding / HR), and difficulty." },
  { num: "03", title: "Practice Out Loud or Type", desc: "Answer via text or voice. The timer keeps the pressure real." },
  { num: "04", title: "Get Detailed Feedback", desc: "Receive per-question scoring, keyword coverage, confidence analysis, and improvement tips." },
];

/* ── Fake demo question preview ────────────────────────── */
const DEMO_QUESTIONS = [
  { type: "Coding", difficulty: "medium", q: "Implement an LRU Cache with O(1) get and put operations.", time: "20 min", color: "#f59e0b", bg: "#fef3c7" },
  { type: "System Design", difficulty: "hard", q: "Design a URL shortener service handling 10M requests/day.", time: "45 min", color: "#ef4444", bg: "#fee2e2" },
  { type: "Technical", difficulty: "easy", q: "Explain the difference between useEffect with and without a dependency array.", time: "8 min", color: "#10b981", bg: "#d1fae5" },
];

export default function LandingPage() {
  const [activeDemo, setActiveDemo] = useState(0);
  const sessions = useCounter(12400);
  const companies = useCounter(40);
  const accuracy = useCounter(94);

  return (
    <div style={{ background: "var(--gradient-hero)", minHeight: "100vh", overflowX: "hidden" }}>

      {/* ── Navbar ──────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 var(--space-lg)",
      }}>
        <div className="landing-nav" style={{ maxWidth: 1120, margin: "0 auto", minHeight: 62, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.03em", display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo.jpg" alt="VoxIntel" style={{ height: 32, width: 32, objectFit: "cover", borderRadius: 8 }} />
            VoxIntel
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Get started free</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section style={{ padding: "96px var(--space-lg) 80px", textAlign: "center", position: "relative" }}>
        {/* Background blobs */}
        <div style={{ position: "absolute", top: -100, right: -100, width: 600, height: 600, background: "radial-gradient(circle, rgba(91,108,249,0.08) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -50, left: -100, width: 500, height: 500, background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />

        <div style={{ maxWidth: 760, margin: "0 auto", position: "relative" }}>
          {/* Badge */}
          <div className="animate-fade-in" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent-light)", border: "1px solid rgba(91,108,249,0.2)", borderRadius: "var(--radius-full)", padding: "6px 16px", marginBottom: 28 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: "pulse 2s infinite" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", fontWeight: 600, color: "var(--accent)" }}>AI-powered interview prep platform</span>
          </div>

          <h1 className="animate-fade-in-1" style={{
            fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.1,
            marginBottom: 24,
          }}>
            Ace your next interview<br />
            <span style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              with intelligent practice
            </span>
          </h1>

          <p className="animate-fade-in-2" style={{ fontSize: "1.15rem", color: "var(--text-secondary)", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7 }}>
            VoxIntel parses your resume, generates role-specific interview questions, evaluates your answers with AI, and tracks your growth over time.
          </p>

          <div className="animate-fade-in-3" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/register" className="btn btn-primary btn-lg" style={{ fontSize: "1rem", padding: "14px 36px" }}>
              Start practicing free →
            </Link>
            <Link to="/login" className="btn btn-outline btn-lg" style={{ fontSize: "1rem", padding: "14px 36px" }}>
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────── */}
      <section style={{ padding: "0 var(--space-lg) 80px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div className="landing-stats-grid">
            {[
              { value: sessions.toLocaleString() + "+", label: "Practice Sessions" },
              { value: companies + "+", label: "Company Profiles" },
              { value: accuracy + "%", label: "Answer Accuracy Tracked" },
            ].map((s, i) => (
              <div key={i} className="card animate-scale-in" style={{ textAlign: "center", padding: "28px 20px" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", fontWeight: 800, background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", lineHeight: 1, marginBottom: 8 }}>{s.value}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontFamily: "var(--font-display)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────── */}
      <section style={{ padding: "80px var(--space-lg)", background: "rgba(255,255,255,0.6)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div className="badge badge-accent" style={{ marginBottom: 16 }}>Features</div>
            <h2 style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 14 }}>
              Everything you need to prepare
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto" }}>
              From resume parsing to coding challenges — VoxIntel covers every stage of the modern tech interview.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="card animate-fade-in" style={{ animationDelay: `${i * 0.07}s`, cursor: "default", padding: "28px" }}>
                <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", marginBottom: 18, border: `1px solid ${f.color}22` }}>
                  {f.icon}
                </div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>{f.title}</h3>
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo Preview ────────────────────────────────── */}
      <section style={{ padding: "96px var(--space-lg)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div className="landing-demo-grid">
            {/* Left: description */}
            <div>
              <div className="badge badge-accent" style={{ marginBottom: 16 }}>Live Preview</div>
              <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16 }}>
                See real questions<br />before you start
              </h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: 32, lineHeight: 1.7 }}>
                VoxIntel generates coding problems, system design questions, and behavioral scenarios — each with a difficulty rating and time budget.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {DEMO_QUESTIONS.map((q, i) => (
                  <button key={i} onClick={() => setActiveDemo(i)} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: "var(--radius-md)",
                    border: `1.5px solid ${activeDemo === i ? "var(--accent)" : "var(--border)"}`,
                    background: activeDemo === i ? "var(--accent-light)" : "var(--bg-surface)",
                    cursor: "pointer", textAlign: "left", transition: "all 0.18s",
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: q.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", fontWeight: 600, color: activeDemo === i ? "var(--accent)" : "var(--text-primary)" }}>{q.type}</span>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginLeft: "auto" }}>{q.time}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: question card preview */}
            <div className="card" style={{ padding: "28px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "var(--gradient-primary)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", padding: "4px 12px",
                  borderRadius: "var(--radius-full)",
                  background: DEMO_QUESTIONS[activeDemo].bg,
                  color: DEMO_QUESTIONS[activeDemo].color,
                  fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>{DEMO_QUESTIONS[activeDemo].difficulty}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: "var(--radius-full)", background: "var(--accent-light)", color: "var(--accent)", fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 600 }}>
                  ⏱ {DEMO_QUESTIONS[activeDemo].time}
                </span>
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.5, marginBottom: 24 }}>
                {DEMO_QUESTIONS[activeDemo].q}
              </p>
              <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {["#ff5f57","#ffbd2e","#28c840"].map((c, i) => <span key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.8 }}>
                  <span style={{ color: "#8b5cf6" }}>def</span> <span style={{ color: "#5b6cf9" }}>solve</span>(<span style={{ color: "#10b981" }}>self</span>):<br />
                  &nbsp;&nbsp;<span style={{ color: "var(--text-muted)" }}># Your solution here...</span><br />
                  &nbsp;&nbsp;<span style={{ color: "#8b5cf6" }}>pass</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Workflow ─────────────────────────────────────── */}
      <section style={{ padding: "80px var(--space-lg)", background: "rgba(255,255,255,0.6)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div className="badge badge-accent" style={{ marginBottom: 16 }}>How it works</div>
            <h2 style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.03em" }}>
              From resume to feedback in minutes
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 24 }}>
            {STEPS.map((step, i) => (
              <div key={i} style={{ position: "relative" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", fontWeight: 600, color: "var(--accent)", letterSpacing: "0.1em", marginBottom: 12 }}>{step.num}</div>
                <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 8 }}>{step.title}</h4>
                <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>{step.desc}</p>
                {i < STEPS.length - 1 && (
                  <div style={{ position: "absolute", top: 8, right: -12, fontSize: "1.2rem", color: "var(--border-bright)", display: "none" }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────── */}
      <section style={{ padding: "96px var(--space-lg)" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            background: "var(--gradient-primary)",
            borderRadius: "var(--radius-xl)",
            padding: "56px 48px",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, background: "rgba(255,255,255,0.08)", borderRadius: "50%" }} />
            <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, background: "rgba(255,255,255,0.06)", borderRadius: "50%" }} />
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2rem", color: "white", marginBottom: 16, letterSpacing: "-0.03em", position: "relative" }}>
              Ready to start practicing?
            </h2>
            <p style={{ color: "rgba(255,255,255,0.82)", marginBottom: 32, lineHeight: 1.65, position: "relative" }}>
              Create your free account and complete your first mock interview in under 10 minutes.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", position: "relative" }}>
              <Link to="/register" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "14px 32px", borderRadius: "var(--radius-lg)",
                background: "white", color: "var(--accent)",
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1rem",
                textDecoration: "none", transition: "all 0.18s",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              }}>
                Get started free →
              </Link>
              <Link to="/login" style={{
                display: "inline-flex", alignItems: "center",
                padding: "14px 32px", borderRadius: "var(--radius-lg)",
                background: "rgba(255,255,255,0.15)", color: "white",
                fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1rem",
                textDecoration: "none", transition: "all 0.18s",
                border: "1.5px solid rgba(255,255,255,0.3)",
              }}>
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "32px var(--space-lg)", background: "rgba(255,255,255,0.6)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.05rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            <span style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Vox</span>Intel
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            AI-powered interview preparation. Practice smarter.
          </p>
          <div style={{ display: "flex", gap: 20 }}>
            <Link to="/login" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Sign in</Link>
            <Link to="/register" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
