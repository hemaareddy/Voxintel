/**
 * InterviewPage.jsx
 * The core interview screen:
 *   - Displays questions one at a time with a countdown timer
 *   - Accepts text or voice (browser speech recognition) input
 *   - Submits answers for AI evaluation
 *   - Shows per-answer feedback immediately
 *   - Navigates to results when all questions answered
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { interviewAPI } from "../utils/api";
import ProgressBar from "../components/ProgressBar";

const QUESTION_TIME_SECONDS = 120; // 2 minutes per question

export default function InterviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = location.state?.session;

  // Redirect to setup if no session data
  useEffect(() => {
    if (!session) navigate("/setup");
  }, [session, navigate]);

  const questions = session?.questions || [];
  const sessionId = session?.sessionId;

  // ── State ────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerText, setAnswerText] = useState("");
  const [answerMode, setAnswerMode] = useState("text");
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SECONDS);
  const [startTime, setStartTime] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // per-answer feedback after submit
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);

  const timerRef = useRef(null);
  const recognitionRef = useRef(null);

  // ── Timer ────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setTimeLeft(QUESTION_TIME_SECONDS);
    setStartTime(Date.now());
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [currentIndex, startTimer]);

  // ── Voice Recognition ─────────────────────────────────────
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(" ");
      setAnswerText(transcript);
    };

    recognition.onerror = (e) => {
      setError(`Voice error: ${e.error}. Please try text mode.`);
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  // ── Submit Answer ─────────────────────────────────────────
  const handleSubmit = async () => {
    if (!answerText.trim()) {
      setError("Please write or speak your answer before submitting.");
      return;
    }

    clearInterval(timerRef.current);
    stopListening();
    setError("");
    setSubmitting(true);

    const timeTaken = Math.round((Date.now() - startTime) / 1000);

    try {
      const res = await interviewAPI.submitAnswer({
        sessionId,
        questionIndex: currentIndex,
        userAnswer: answerText,
        answerMode,
        timeTakenSeconds: timeTaken,
      });

      setFeedback(res.data);
      setAnsweredCount((n) => n + 1);
    } catch (err) {
      setError(err.response?.data?.error || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Next Question ─────────────────────────────────────────
  const handleNext = () => {
    setFeedback(null);
    setAnswerText("");
    setError("");

    if (currentIndex + 1 >= questions.length) {
      handleComplete();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  // ── Skip Question ─────────────────────────────────────────
  const handleSkip = () => {
    setFeedback(null);
    setAnswerText("");
    setError("");
    if (currentIndex + 1 >= questions.length) {
      handleComplete();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  // ── Complete Session ──────────────────────────────────────
  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await interviewAPI.complete(sessionId);
      navigate("/results", { state: { summary: res.data.summary, sessionId } });
    } catch (err) {
      setError("Could not complete session: " + (err.response?.data?.error || err.message));
      setCompleting(false);
    }
  };

  if (!session || questions.length === 0) return null;

  const currentQ = questions[currentIndex];
  const progress = Math.round(((currentIndex) / questions.length) * 100);
  const timerWarning = timeLeft <= 30;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="page">
      <div className="container-sm">

        {/* Session header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-lg)" }}>
          <div>
            <span className="tag" style={{ display: "block" }}>MOCK INTERVIEW</span>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {session.config?.role} · {session.config?.company} · {session.config?.difficulty}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className={`timer ${timerWarning ? "warning" : ""}`}>{formatTime(timeLeft)}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-muted)" }}>time left</div>
          </div>
        </div>

        {/* Overall progress */}
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="question-counter">Question {currentIndex + 1} of {questions.length}</span>
            <span className="question-counter">{answeredCount} answered</span>
          </div>
          <ProgressBar score={progress} showScore={false} />
        </div>

        {/* Question card */}
        <div className="question-card animate-fade-in" style={{ marginBottom: "var(--space-lg)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: "var(--space-md)" }}>
            <span className={`difficulty-badge ${currentQ.difficulty}`}>
              {currentQ.difficulty === "easy" ? "🟢" : currentQ.difficulty === "hard" ? "🔴" : "🟡"} {currentQ.difficulty}
            </span>
            {currentQ.time_limit_minutes && (
              <span className="time-limit-badge">⏱ {currentQ.time_limit_minutes} min</span>
            )}
            <span className="badge badge-gray" style={{ marginLeft: "auto" }}>{currentQ.category}</span>
          </div>

          <h3 style={{ fontSize: "1.15rem", fontWeight: 600, lineHeight: 1.55, color: "var(--text-primary)", marginBottom: currentQ.is_coding ? "var(--space-md)" : 0 }}>
            {currentQ.question}
          </h3>

          {/* Coding question: show expected concepts */}
          {currentQ.is_coding && currentQ.expected_concepts && currentQ.expected_concepts.length > 0 && (
            <div style={{ marginTop: "var(--space-md)", padding: "10px 14px", background: "var(--accent-light)", borderRadius: "var(--radius-md)", borderLeft: "3px solid var(--accent)" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Expected concepts:
              </span>
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {currentQ.expected_concepts.map((c, i) => (
                  <span key={i} className="badge badge-accent" style={{ fontSize: "0.72rem" }}>{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Feedback panel (shown after submission) */}
        {feedback && !submitting && (
          <div className="card animate-fade-in" style={{ marginBottom: "var(--space-lg)", borderColor: "var(--border-bright)" }}>
            <h4 style={{ marginBottom: "var(--space-md)" }}>📊 Answer Evaluation</h4>

            {/* Score bars */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
              <ProgressBar label="Overall Score" score={feedback.scores?.overall} />
              <ProgressBar label="Semantic Match" score={feedback.scores?.semantic} />
              <ProgressBar label="Technical Keywords" score={feedback.scores?.keyword} />
              <ProgressBar label="Answer Depth" score={feedback.scores?.completeness} />
              {feedback.confidence?.score !== null && feedback.confidence?.score !== undefined && (
                <ProgressBar label="Confidence" score={feedback.confidence.score} />
              )}
            </div>

            {/* Feedback text */}
            {feedback.feedback && (
              <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", marginBottom: "var(--space-md)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--accent)", marginBottom: 8, letterSpacing: "0.06em" }}>
                  FEEDBACK
                </div>
                <p className="feedback-section" style={{ fontSize: "0.88rem" }}>{feedback.feedback}</p>
              </div>
            )}

            {/* Plagiarism warning */}
            {feedback.plagiarism && !feedback.plagiarism.isOriginal && (
              <div className="alert alert-warn" style={{ marginBottom: "var(--space-md)" }}>
                ⚠️ Originality flag: {feedback.plagiarism.feedback}
              </div>
            )}

            <button className="btn btn-primary btn-block" onClick={handleNext}>
              {currentIndex + 1 >= questions.length ? "Finish & See Results →" : "Next Question →"}
            </button>
          </div>
        )}

        {/* Answer input (hidden after submission) */}
        {!feedback && (
          <div className="animate-fade-in-1">
            {/* Mode selector */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
              <h4>Your Answer</h4>
              <div className="mode-tabs">
                <button
                  className={`mode-tab ${answerMode === "text" ? "active" : ""}`}
                  onClick={() => { setAnswerMode("text"); stopListening(); }}
                >
                  ✏️ Text
                </button>
                <button
                  className={`mode-tab ${answerMode === "voice" ? "active" : ""}`}
                  onClick={() => setAnswerMode("voice")}
                >
                  🎙️ Voice
                </button>
              </div>
            </div>

            {/* Text area */}
            <textarea
              placeholder="Type your answer here... Explain the concept clearly, give examples, mention relevant keywords."
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              style={{ minHeight: 160, marginBottom: "var(--space-md)" }}
            />

            {/* Voice controls */}
            {answerMode === "voice" && (
              <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-md)", alignItems: "center" }}>
                {!listening ? (
                  <button className="btn btn-outline" onClick={startListening}>
                    🎙️ Start Recording
                  </button>
                ) : (
                  <button className="btn btn-danger" onClick={stopListening}>
                    ⏹ Stop Recording
                  </button>
                )}
                {listening && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--accent)" }} className="pulse">
                    ● Recording...
                  </span>
                )}
              </div>
            )}

            {error && <div className="alert alert-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "var(--space-md)" }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleSubmit}
                disabled={submitting || !answerText.trim()}
              >
                {submitting
                  ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Evaluating...</>
                  : "Submit Answer"
                }
              </button>
              <button className="btn btn-ghost" onClick={handleSkip} disabled={submitting}>
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Finish early button */}
        {answeredCount > 0 && !completing && (
          <div style={{ marginTop: "var(--space-xl)", textAlign: "center" }}>
            <button className="btn btn-ghost btn-sm" onClick={handleComplete} disabled={completing}>
              {completing ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Finish Early & See Results"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
