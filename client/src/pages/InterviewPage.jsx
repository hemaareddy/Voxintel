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
import Editor from "@monaco-editor/react";
import { interviewAPI } from "../utils/api";
import ProgressBar from "../components/ProgressBar";

const QUESTION_TIME_SECONDS = 120; // 2 minutes per question

// Coding questions can be solved in whichever of these languages the
// question's starterCode dict actually has an entry for (see
// coding_questions.py + server/services/execution/ — C isn't offered since
// there's no C compiler available to grade it). A correct solution in any
// one of them is graded as correct — the executor is picked by `language`.
const LANGUAGE_LABELS = {
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
};

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
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SECONDS);
  const [startTime, setStartTime] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // per-answer feedback after submit
  const [followUpQuestion, setFollowUpQuestion] = useState(null); // adaptive follow-up, if any
  const [followUpAnswerText, setFollowUpAnswerText] = useState("");
  const [followUpFeedback, setFollowUpFeedback] = useState(null); // { skipped: true } or eval result
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);

  // ── Lockdown (anti-cheating) state ─────────────────────────
  // Browsers won't let JS actually block tab/window switching (no site can
  // disable Alt+Tab or Ctrl+T) — so instead we detect it after the fact via
  // the Page Visibility API + window blur + exiting fullscreen, and react:
  // 1st time → warning, 2nd time → end the session immediately.
  const [hasStarted, setHasStarted] = useState(false); // gated behind a user gesture (fullscreen requires one)
  const [violationCount, setViolationCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastViolationTimeRef = useRef(0);

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
    if (!hasStarted) return;
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [currentIndex, startTimer, hasStarted]);

  // Reset to a language the new question actually supports whenever we land
  // on a (possibly different) coding question.
  useEffect(() => {
    const q = questions[currentIndex];
    if (q?.type !== "coding") return;
    const supported = Object.keys(q.starterCode || {});
    setCodeLanguage((prev) => (supported.includes(prev) ? prev : supported[0] || "javascript"));
  }, [currentIndex]);

  // Seed the editor with starter code for the selected language, whenever
  // the question or the language changes (runs after handleNext/handleSkip's
  // plain setAnswerText("") reset, so this is the final word on what the
  // input should show).
  useEffect(() => {
    const q = questions[currentIndex];
    setAnswerText(q?.type === "coding" ? q.starterCode?.[codeLanguage] || "" : "");
  }, [currentIndex, codeLanguage]);

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
    const isCodingQuestion = questions[currentIndex]?.type === "coding";

    try {
      const res = await interviewAPI.submitAnswer({
        sessionId,
        questionIndex: currentIndex,
        userAnswer: answerText,
        answerMode,
        timeTakenSeconds: timeTaken,
        ...(isCodingQuestion ? { language: codeLanguage } : {}),
      });

      setFeedback(res.data);
      setAnsweredCount((n) => n + 1);
      if (res.data.followUpQuestion) {
        setFollowUpQuestion(res.data.followUpQuestion);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit Follow-up Answer ─────────────────────────────────
  const handleSubmitFollowUp = async () => {
    if (!followUpAnswerText.trim()) {
      setError("Please answer the follow-up, or skip it.");
      return;
    }
    setError("");
    setSubmittingFollowUp(true);

    try {
      const res = await interviewAPI.submitAnswer({
        sessionId,
        questionIndex: currentIndex,
        userAnswer: followUpAnswerText,
        answerMode: "text",
        timeTakenSeconds: 0,
        isFollowUp: true,
      });
      setFollowUpFeedback(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Follow-up submission failed. Please try again.");
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  const handleSkipFollowUp = () => {
    setFollowUpFeedback({ skipped: true });
  };

  // ── Next Question ─────────────────────────────────────────
  const handleNext = () => {
    setFeedback(null);
    setAnswerText("");
    setFollowUpQuestion(null);
    setFollowUpAnswerText("");
    setFollowUpFeedback(null);
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
    setFollowUpQuestion(null);
    setFollowUpAnswerText("");
    setFollowUpFeedback(null);
    setError("");
    if (currentIndex + 1 >= questions.length) {
      handleComplete();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  // ── Complete Session ──────────────────────────────────────
  const handleComplete = async (terminatedReason = null) => {
    setCompleting(true);
    try {
      const res = await interviewAPI.complete(sessionId);
      navigate("/results", { state: { summary: res.data.summary, sessionId, terminatedReason } });
    } catch (err) {
      if (terminatedReason) {
        // Even if scoring the partial session failed, don't strand the user
        // mid-interview after a lockdown violation — still leave the screen.
        navigate("/results", { state: { terminatedReason } });
        return;
      }
      setError("Could not complete session: " + (err.response?.data?.error || err.message));
      setCompleting(false);
    }
  };

  // ── Lockdown: enter fullscreen (requires this click as the user gesture) ──
  const handleBeginLocked = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      // Fullscreen can be denied/unsupported (browser policy, embedded iframe,
      // etc.) — tab/window-switch detection still works without it, so don't
      // block the interview over it.
      console.warn("Could not enter fullscreen:", err);
    }
    setHasStarted(true);
  };

  // ── Lockdown: react to a detected tab/window switch or fullscreen exit ──
  const handleViolation = useCallback(() => {
    const now = Date.now();
    if (now - lastViolationTimeRef.current < 1500) return; // coalesce events from the same departure
    lastViolationTimeRef.current = now;

    setViolationCount((prev) => {
      const next = prev + 1;
      if (next >= 2) {
        setShowWarning(false);
        handleComplete("tab-switch");
      } else {
        setShowWarning(true);
      }
      return next;
    });
  }, []);

  // Attach violation listeners only once the candidate has actually started.
  useEffect(() => {
    if (!hasStarted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) handleViolation();
    };
    const handleBlur = () => handleViolation();
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) handleViolation();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [hasStarted, handleViolation]);

  // Always leave fullscreen behind when the interview page unmounts
  // (session completed, terminated, or the user navigated away).
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const handleResumeAfterWarning = async () => {
    setShowWarning(false);
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.warn("Could not re-enter fullscreen:", err);
      }
    }
  };

  if (!session || questions.length === 0) return null;

  // Gate the actual interview behind a click — entering fullscreen requires
  // a user gesture, and this is also the natural place to explain the rules.
  if (!hasStarted) {
    return (
      <div className="page-center">
        <div className="card animate-fade-in" style={{ maxWidth: 480, textAlign: "center", padding: "var(--space-xl)" }}>
          <span className="tag" style={{ display: "inline-block", marginBottom: "var(--space-md)" }}>MOCK INTERVIEW</span>
          <h2 style={{ marginBottom: "var(--space-md)" }}>Ready to begin?</h2>
          <p style={{ marginBottom: "var(--space-lg)", color: "var(--text-secondary)" }}>
            This interview runs in fullscreen and monitors tab/window switching, just like a
            real proctored assessment. Leaving the interview screen once will show a warning —
            a second time will end your session immediately and take you to your results.
          </p>
          <button className="btn btn-primary btn-lg btn-block" onClick={handleBeginLocked}>
            Enter Fullscreen &amp; Start Interview →
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const isCoding = currentQ.type === "coding";
  const progress = Math.round(((currentIndex) / questions.length) * 100);
  const timerWarning = timeLeft <= 30;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="page">
      {/* Lockdown warning — 1st violation only; a 2nd ends the session immediately */}
      {showWarning && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: "var(--space-lg)",
          }}
        >
          <div className="card animate-scale-in" style={{ maxWidth: 440, textAlign: "center", padding: "var(--space-xl)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-md)" }}>⚠️</div>
            <h3 style={{ marginBottom: "var(--space-md)" }}>Warning: You Left the Interview</h3>
            <p style={{ marginBottom: "var(--space-lg)", color: "var(--text-secondary)" }}>
              Switching tabs, apps, or exiting fullscreen during the interview isn't allowed.
              This is your only warning — if it happens again, your interview will end
              immediately and you'll be taken straight to your results.
            </p>
            <button className="btn btn-primary btn-block" onClick={handleResumeAfterWarning}>
              I Understand, Continue
            </button>
          </div>
        </div>
      )}

      <div className="container-sm">

        {/* Session header */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
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

          {isCoding && currentQ.title && (
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem", marginBottom: 6, color: "var(--accent)" }}>
              {currentQ.title}
            </div>
          )}

          <h3 style={{ fontSize: "1.15rem", fontWeight: 600, lineHeight: 1.55, color: "var(--text-primary)", marginBottom: isCoding ? "var(--space-md)" : 0 }}>
            {currentQ.question}
          </h3>

          {/* Coding question: show example test cases + expected concepts */}
          {isCoding && currentQ.testCases && currentQ.testCases.length > 0 && (
            <div style={{ marginTop: "var(--space-md)", padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, color: "var(--text-muted)" }}>
                Examples
              </div>
              {currentQ.testCases.map((tc, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  {currentQ.functionName}({tc.args.map((a) => JSON.stringify(a)).join(", ")}) → {JSON.stringify(tc.expected)}
                </div>
              ))}
            </div>
          )}

          {isCoding && currentQ.expectedConcepts && currentQ.expectedConcepts.length > 0 && (
            <div style={{ marginTop: "var(--space-md)" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Relevant concepts:
              </span>
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {currentQ.expectedConcepts.map((c, i) => (
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
              {feedback.testResults ? (
                <ProgressBar label="Tests Passed" score={feedback.scores?.overall} />
              ) : (
                <>
                  <ProgressBar label="Overall Score" score={feedback.scores?.overall} />
                  <ProgressBar label="Semantic Match" score={feedback.scores?.semantic} />
                  <ProgressBar label="Technical Keywords" score={feedback.scores?.keyword} />
                  <ProgressBar label="Answer Depth" score={feedback.scores?.completeness} />
                </>
              )}
              {feedback.confidence?.score !== null && feedback.confidence?.score !== undefined && (
                <ProgressBar label="Confidence" score={feedback.confidence.score} />
              )}
            </div>

            {/* Per-test-case results (coding answers only) */}
            {feedback.testResults && (
              <div style={{ marginBottom: "var(--space-md)" }}>
                {feedback.testResults.map((tr, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", justifyContent: "space-between", gap: 8,
                      padding: "8px 12px", marginBottom: 4, borderRadius: "var(--radius-md)",
                      background: "var(--bg-elevated)", fontFamily: "var(--font-mono)", fontSize: "0.8rem",
                    }}
                  >
                    <span>{tr.passed ? "✅" : "❌"} Test case {i + 1}</span>
                    {!tr.passed && (
                      <span style={{ color: "var(--text-muted)" }}>
                        {tr.error ? tr.error : `expected ${JSON.stringify(tr.expectedOutput)}, got ${JSON.stringify(tr.actualOutput)}`}
                      </span>
                    )}
                  </div>
                ))}
                {feedback.hiddenTestSummary && feedback.hiddenTestSummary.total > 0 && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 6 }}>
                    Hidden tests: {feedback.hiddenTestSummary.passed}/{feedback.hiddenTestSummary.total} passed
                  </div>
                )}
              </div>
            )}

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

            {/* Adaptive follow-up question, based on this answer's keyword coverage */}
            {followUpQuestion && !followUpFeedback && (
              <div className="alert alert-info animate-fade-in" style={{ marginBottom: "var(--space-md)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", marginBottom: 8, letterSpacing: "0.06em" }}>
                  FOLLOW-UP QUESTION
                </div>
                <p style={{ marginBottom: "var(--space-md)", fontWeight: 600 }}>{followUpQuestion}</p>
                <textarea
                  placeholder="Answer the follow-up..."
                  value={followUpAnswerText}
                  onChange={(e) => setFollowUpAnswerText(e.target.value)}
                  style={{ minHeight: 100, marginBottom: "var(--space-md)" }}
                />
                <div style={{ display: "flex", gap: "var(--space-md)" }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={handleSubmitFollowUp}
                    disabled={submittingFollowUp || !followUpAnswerText.trim()}
                  >
                    {submittingFollowUp
                      ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Evaluating...</>
                      : "Submit Follow-up"
                    }
                  </button>
                  <button className="btn btn-ghost" onClick={handleSkipFollowUp} disabled={submittingFollowUp}>
                    Skip
                  </button>
                </div>
              </div>
            )}

            {/* Follow-up evaluation result */}
            {followUpFeedback && !followUpFeedback.skipped && (
              <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", marginBottom: "var(--space-md)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--accent)", marginBottom: 8, letterSpacing: "0.06em" }}>
                  FOLLOW-UP EVALUATION — {followUpFeedback.scores?.overall}/100
                </div>
                <p className="feedback-section" style={{ fontSize: "0.88rem" }}>{followUpFeedback.feedback}</p>
              </div>
            )}

            {(!followUpQuestion || followUpFeedback) && (
              <button className="btn btn-primary btn-block" onClick={handleNext}>
                {currentIndex + 1 >= questions.length ? "Finish & See Results →" : "Next Question →"}
              </button>
            )}
          </div>
        )}

        {/* Answer input (hidden after submission) */}
        {!feedback && (
          <div className="animate-fade-in-1">
            {isCoding ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                  <h4>Your Code</h4>
                  <select
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value)}
                    aria-label="Programming language"
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: "0.82rem", padding: "6px 10px",
                      borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
                      background: "var(--bg-elevated)", color: "var(--text-primary)",
                    }}
                  >
                    {Object.keys(currentQ.starterCode || { javascript: true }).map((lang) => (
                      <option key={lang} value={lang}>{LANGUAGE_LABELS[lang] || lang}</option>
                    ))}
                  </select>
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: "var(--space-md)" }}>
                  <Editor
                    height="320px"
                    language={codeLanguage}
                    theme="vs-dark"
                    value={answerText}
                    onChange={(value) => setAnswerText(value ?? "")}
                    options={{ minimap: { enabled: false }, fontSize: 14, tabSize: 2 }}
                  />
                </div>
              </>
            ) : (
              <>
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
              </>
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
                  ? <><span className="spinner" style={{ width: 16, height: 16 }} /> {isCoding ? "Running tests..." : "Evaluating..."}</>
                  : (isCoding ? "Run & Submit Code" : "Submit Answer")
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
