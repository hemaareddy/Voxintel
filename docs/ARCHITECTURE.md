# VoxIntel — Architecture & Workflow

## System Overview

VoxIntel is a three-tier application:

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React)                      │
│   Login → Resume Upload → Setup → Interview → Results   │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (JSON)
                       │ Port 3000 → proxied to 5000
┌──────────────────────▼──────────────────────────────────┐
│              Node.js / Express Backend                   │
│   Auth · Resume · Interview · Questions · Analytics     │
└──────────────────┬───────────────────┬──────────────────┘
                   │ Mongoose           │ Axios HTTP
                   │                   │ Port 5001
┌──────────────────▼──────┐  ┌─────────▼────────────────┐
│       MongoDB            │  │  Python Flask NLP Service │
│  Users · Resumes         │  │  Resume Parser            │
│  Sessions · Questions    │  │  Semantic Evaluator       │
│  Analytics               │  │  Confidence Analyser      │
└─────────────────────────┘  │  Plagiarism Checker       │
                              │  Question Generator       │
                              │  Feedback Generator       │
                              │  Resume Intelligence      │
                              │  Hybrid Question Generator│
                              │  Follow-up Generator      │
                              │  Coding Question Generator│
                              │  Code Follow-up Generator │
                              └──────────────────────────┘
```

The Node backend also runs candidate-submitted code directly (coding-round grading) — this is
Node-side and sandboxed (`server/services/codeExecutionService.js`), not part of the Python
service. See "Coding-Only Sessions" below and its security note.

---

## Design Philosophy

The project intentionally separates two types of logic:

### Deterministic Workflows
Predictable, testable, reliable — no AI involved:
- User authentication (JWT)
- File upload and storage
- Database reads and writes
- Question selection from database
- Session lifecycle management
- Score aggregation and analytics
- API routing and validation
- Coding-round grading: actually running the candidate's submitted code against test cases
  in a sandboxed worker thread and comparing output (`server/services/codeExecutionService.js`)
  — no NLP/AI involved, this is a pass/fail check, not a language model judging the code

### AI-Assisted Workflows
Uses NLP models and heuristics:
- Resume text extraction and skill parsing (SpaCy + regex)
- Semantic answer evaluation (Sentence-Transformers cosine similarity)
- Confidence analysis (filler word detection, hedging patterns)
- Plagiarism/AI-content detection (statistical heuristics)
- Personalized feedback generation
- Project-based question generation
- Resume intelligence: candidate level, readiness score, and recommended difficulty derived from
  parsed resume data (`resume_intelligence.py`, `/analyze-intelligence`)
- Hybrid question generation: blends resume-derived questions with dataset questions
  (`hybrid_question_generator.py`, `/generate-questions-hybrid`)
- Adaptive follow-up generation: a follow-up question built from which keywords the
  candidate's answer did or didn't cover — not a canned string
  (`followup_generator.py`, `/generate-followup`)
- Coding question selection: choosing 60% static / 40% resume-skill-matched problems from
  a pre-authored bank (`coding_question_generator.py`, `/generate-coding-questions`) — the
  problems themselves are fixed content; only which ones get picked is resume-aware
- Code follow-up generation: a follow-up about a coding submission's complexity/edge cases,
  built from pass/fail state and the problem's expected_concepts — Coding Interview only
  (`code_followup_generator.py`, `/generate-code-followup`)

---

## Complete Interview Workflow

```
User fills Setup Form
        │
        ▼
POST /api/interview/start
  ├─ Load resume skills (if resumeId provided)
  ├─ Map interviewType → question categories
  ├─ Query MongoDB: filter by category + difficulty (± company tags), fetch candidate pool
  ├─ If resume is parsed: POST to Python :5001/generate-questions-hybrid
  │     (parsed resume + intelligence + dataset pool → hybrid question set,
  │      50% resume-derived / 50% dataset; falls back to dataset-only on failure)
  │   Else: shuffle dataset pool and slice to questionCount
  ├─ Mark follow-up-eligible questions: every resume-derived question, plus
  │     enough dataset questions to guarantee at least 3 per session
  └─ Create InterviewSession document → return questions + candidateIntelligence
      + questionSourceDistribution
        │
        ▼
Frontend: display Q1, start countdown timer
        │
User submits answer
        │
        ▼
POST /api/interview/answer
  ├─ Load ideal_answer + keywords from Question model
  ├─ POST to Python :5001/evaluate-answer
  │     ├─ semantic_evaluator.py  → cosine similarity score
  │     ├─ confidence_analysis.py → filler words, hedging
  │     ├─ plagiarism_checker.py  → AI pattern detection
  │     └─ feedback_generator.py  → combined feedback text
  ├─ Fallback: keyword-only scoring if Python service down
  ├─ Save scores to session.answers[index]
  ├─ If this question is follow-up-eligible and hasn't had one yet:
  │     POST to Python :5001/generate-followup (user_answer + keywords)
  │     → adaptive follow-up question, saved to answers[index].followUp
  └─ Return scores + feedback (+ followUpQuestion, if generated) to frontend
        │
        ▼
Frontend: shows the follow-up (if any) and blocks "Next Question" until it's
answered (POST /api/interview/answer again, same indices, isFollowUp: true —
scored the same way, saved to answers[index].followUp, not stored back into
the primary answer) or explicitly skipped
        │
        ▼
Frontend: show per-answer scores, next question
        │
All questions answered
        │
        ▼
POST /api/interview/complete
  ├─ Aggregate scores across all answers AND their answered follow-ups
  │     (each answered follow-up is an additional graded item in its
  │      parent question's category)
  ├─ Compute averages: semantic, overall, confidence
  ├─ Identify strong areas (avg ≥ 70) and weak areas (avg < 50)
  ├─ Update InterviewSession.summary
  ├─ Update User.stats cache
  └─ Return summary → navigate to /results
```

---

## Interview Lockdown (Anti-Cheating)

Purely client-side (`client/src/pages/InterviewPage.jsx`) — no new API surface, no
server-side record of violations. Browsers don't let JavaScript actually *prevent*
tab or window switching (no website can block Alt+Tab or Ctrl+T), so this is
detection-and-react rather than real prevention, the same approach real proctored
assessment platforms use:

```
Candidate clicks "Enter Fullscreen & Start Interview" (a required user gesture —
fullscreen can't be requested without one)
        │
        ▼
document.documentElement.requestFullscreen() (best-effort; interview proceeds
even if denied/unsupported — tab-switch detection doesn't depend on fullscreen)
        │
        ▼
Listeners attached: visibilitychange, window blur, fullscreenchange
        │
        ▼
1st violation (any of the three fires, debounced 1.5s so one physical tab-switch
that fires blur + fullscreenchange together doesn't double-count) → warning modal
        │
        ▼
Candidate clicks "I Understand, Continue" → re-requests fullscreen if needed, resumes
        │
        ▼
2nd violation → handleComplete("tab-switch") → POST /api/interview/complete
(same endpoint "Finish Early" uses) → navigate to /results with
terminatedReason: "tab-switch" in router state → ResultsPage shows a banner
```

---

## Coding-Only Sessions (`interviewType: "Coding Interview"` / `"Coding Round"`)

A completely separate path from the workflow above — no dataset `Question` lookup, no
`generate-questions-hybrid`. Every question is a hands-on programming problem, edited in a
Monaco editor (`@monaco-editor/react`) in the browser.

**`Coding Interview` and `Coding Round` differ in exactly one way**: whether questions are
follow-up-eligible. `Coding Interview` marks every question eligible — after grading, the
candidate gets an adaptive question about their approach (complexity, edge cases,
optimization), answered in prose, like a live interviewer probing the solution.
`Coding Round` never marks anything eligible — submit, get graded, move on, a straight
timed-assessment feel. This is set once, in `sessionController.startCodingSession`
(`CODING_TYPES_WITH_FOLLOWUPS`), and everything downstream (follow-up generation, its
text-based evaluation, session aggregation) is the same machinery already used for
adaptive follow-ups on text Q&A — see "Complete Interview Workflow" above.

```
POST /api/interview/start (interviewType is a coding type)
  ├─ sessionController.startCodingSession — branches immediately, skips the
  │     dataset/hybrid Q&A flow entirely
  ├─ POST to Python :5001/generate-coding-questions (candidate's resume skills, count)
  │     coding_question_generator.py selects 60% from the static bank
  │     (coding_questions.py) + 40% prioritized toward skill-matched problems
  ├─ Store each question's public test_cases AND hidden_test_cases in
  │     InterviewSession.answers[i] — hidden ones never leave the server
  ├─ Mark every question followUpEligible: true if interviewType === "Coding Interview",
  │     else false (Coding Round)
  └─ Return questions (prompt, starterCode [per-language dict], functionName,
        public testCases only)
        │
        ▼
Frontend: language selector (only languages the question's starterCode dict
has an entry for) + Monaco editor pre-filled with starterCode[language],
"Run & Submit Code"
        │
POST /api/interview/answer (userAnswer = the candidate's source, language: "javascript"|"python"|"java")
  ├─ answerController.submitCodeAnswer — branches on answers[i].type === "coding"
  ├─ execution/index.js dispatches to the executor for `language` (falls back to
  │     javascript if unrecognized):
  │       - javascript → codeExecutionService.runCode — isolated worker thread,
  │         restricted vm context, 2s execution timeout (5s hard backstop)
  │       - python → execution/pythonExecutor.js — spawns the system `python`
  │         interpreter as a child process (no sandbox — see security note)
  │       - java → execution/javaExecutor.js — compiles with `javac`, runs with
  │         `java`; the candidate's `class Solution {...}` is appended to a fixed
  │         reflection-based driver (execution/templates/JavaDriver.template.java)
  │         that finds the target method and coerces JSON test-case args to
  │         whatever types it declares, so the driver needs no per-question
  │         knowledge of argument shapes (no sandbox here either)
  │       - C is not offered — no compiler available to build/verify a driver
  ├─ Score = percentage of test cases passed (same value for all 4 score fields,
  │     so it folds into the existing summary aggregation unchanged)
  ├─ If followUpEligible: POST to Python :5001/generate-code-followup
  │     (passed/total counts, expected_concepts, first PUBLIC failure only)
  │     → adaptive follow-up question, saved to answers[index].followUp
  └─ Return public test results + a hidden-test pass count (no hidden inputs/
      expected values ever sent to the client) + followUpQuestion (if generated)
        │
        ▼ (Coding Interview only)
Frontend shows the follow-up, blocks "Next Question" until answered/skipped —
same UI as text-question follow-ups
        │
        ▼
POST /api/interview/answer (isFollowUp: true, userAnswer = prose, not code)
  ├─ answerController.submitFollowUpAnswer — evaluated via the normal text
  │     pipeline (POST :5001/evaluate-answer), using the coding question's
  │     expectedConcepts as the keyword list (no ideal_answer for a coding follow-up)
  └─ Scored the same way any follow-up is; folds into session aggregation
```

### Security note on code execution

`codeExecutionService.js` runs **arbitrary candidate-submitted JavaScript**. It is a
**best-effort sandbox** (an isolated `worker_thread` + a `vm` context exposing only a
handful of safe built-ins, with an execution timeout) appropriate for a **trusted,
single-user local dev tool** — this is explicitly not a hardened multi-tenant execution
service. Node's own docs state the `vm` module is not a security boundary against
determined adversarial code. Verified protections: the classic Function-constructor
context-escape trick is blocked (V8's `vm.createContext` gives each submission its own
realm), `process`/`require`/filesystem access is not exposed, and infinite loops are
killed by the in-`vm` timeout (backed by a hard `worker.terminate()` after 5s). **Do not
expose this to public/multi-tenant traffic without real OS-level isolation** (Docker with
dropped capabilities, gVisor, Firecracker, or similar) — see
`server/services/codeExecutionWorker.js` for the full caveat.

**Python and Java have no sandbox at all.** `execution/pythonExecutor.js` and
`execution/javaExecutor.js` spawn the real interpreter/compiler as plain OS child
processes (a temp directory per submission, deleted afterward) with full
filesystem/network access — equivalent to the candidate running their own code
in a terminal. This is a strictly bigger trust concession than the JS `vm` path
and is only acceptable under the same "trusted single local user" model: the
person submitting the code is the same person whose machine it runs on. The
same public/multi-tenant warning above applies with even more force to these
two paths. C is deliberately not implemented — there's no C compiler on this
project's dev machine to build and verify a driver against.

---

## Resume Parsing Workflow

```
User uploads PDF/DOCX
        │
        ▼
POST /api/resume/upload (Node.js)
  ├─ Multer saves file to /uploads/temp/
  ├─ UUID rename → /uploads/<uuid>.pdf
  ├─ Create Resume document (status: "uploaded")
  ├─ Kick off async triggerNLPParsing()
  └─ Return resumeId immediately (don't wait for parsing)
        │
        ▼ (async, background)
triggerNLPParsing()
  ├─ Update status: "processing"
  ├─ POST file to Python :5001/parse-resume
  │     ├─ resume_parser.py extracts raw text (PDF/DOCX)
  │     ├─ Preprocesses text (lowercase, normalize)
  │     ├─ Extracts skills via keyword matching (ALL_SKILLS list)
  │     ├─ Extracts projects via section heading detection
  │     ├─ Extracts education, certifications, experience
  │     ├─ resume_intelligence.py generates an intelligence report
  │     │   (candidateLevel, readinessScore, recommendedDifficulty,
  │     │    strengths, improvementAreas) — attached to the response
  │     └─ Returns structured JSON (parsed fields + intelligence)
  ├─ Save parsed data + intelligence to Resume document
  └─ Update status: "parsed" (or "failed")
        │
        ▼
Frontend polls GET /api/resume/:id/status every 2 seconds
until status === "parsed", then displays extracted data
        │
        ▼
GET /api/resume/:id/insights → returns the cached intelligence report
(re-generates via POST :5001/analyze-intelligence if missing, e.g. for older resumes)
```

---

## Semantic Evaluation Pipeline

```
userAnswer (text)
idealAnswer (from Question DB)
keywords    (from Question DB)
        │
        ▼
semantic_evaluator.py
  ├─ Encode both texts with Sentence-Transformers (all-MiniLM-L6-v2)
  │   → 384-dimension embedding vectors
  ├─ Compute cosine similarity → semantic_score (0-100)
  ├─ Count keyword matches in user answer → keyword_score (0-100)
  ├─ Check answer length + structural cues → completeness_score (0-100)
  └─ Weighted composite:
       overall = 0.40×semantic + 0.35×keyword + 0.25×completeness
        │
        ▼
confidence_analysis.py
  ├─ Count filler words (um, uh, like, basically...)
  ├─ Count hedging phrases (I think, maybe, probably...)
  ├─ Count confidence signals (for example, therefore...)
  ├─ Check submission speed (words per second)
  └─ Compute confidence score + feedback + suggestions
        │
        ▼
plagiarism_checker.py
  ├─ Detect AI opener patterns (Certainly!, Great question...)
  ├─ Detect AI filler phrases (In conclusion, It's important to note...)
  ├─ Compute sentence length variance (low = AI-like)
  ├─ Compute type-token ratio (very high = suspiciously rich vocab)
  ├─ Check submission speed (too fast = likely pasted)
  └─ Compute plagiarism_score + ai_score + is_original flag
        │
        ▼
feedback_generator.py
  Combines all three scores into a
  human-readable, actionable feedback paragraph
```

---

## Directory Structure

```
VoxIntel/
├── client/                    # React frontend
│   ├── public/index.html
│   └── src/
│       ├── App.jsx            # Router + route definitions
│       ├── index.js           # React entry point
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── ProgressBar.jsx
│       │   ├── ProtectedRoute.jsx
│       │   └── ScoreRing.jsx
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── RegisterPage.jsx
│       │   ├── DashboardPage.jsx
│       │   ├── ResumePage.jsx
│       │   ├── SetupPage.jsx
│       │   ├── InterviewPage.jsx
│       │   ├── ResultsPage.jsx
│       │   └── AnalyticsPage.jsx
│       ├── styles/global.css  # Design system + tokens
│       └── utils/
│           ├── api.js         # Axios client + all API calls
│           └── AuthContext.js # Global auth state (React Context)
│       # No custom hooks yet — add a hooks/ folder if/when one is needed
│
├── server/                    # Node.js + Express backend (own package.json, .env)
│   ├── index.js               # App entry point (exports app; only listens/connects when run directly)
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   └── seed.js            # Database seeder
│   ├── services/
│   │   ├── pythonNlpClient.js      # All axios calls to the Python NLP service, in one place
│   │   ├── codeExecutionService.js # Sandboxed JS grading (worker_thread + vm) for coding-round submissions
│   │   ├── codeExecutionWorker.js  # Runs inside a worker_thread — see its security note
│   │   └── execution/              # Multi-language grading dispatch
│   │       ├── index.js                        # Picks the executor for the submitted `language`
│   │       ├── pythonExecutor.js                # Spawns `python` as a child process — no sandbox
│   │       ├── javaExecutor.js                  # Compiles/runs via `javac`/`java` — no sandbox
│   │       └── templates/JavaDriver.template.java  # Generic reflection-based driver appended to candidate code
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── resumeController.js
│   │   ├── analyticsController.js
│   │   └── interview/
│   │       ├── sessionController.js     # startSession, getSession, getHistory
│   │       ├── answerController.js      # submitAnswer + fallback scoring
│   │       └── completionController.js  # completeSession, score aggregation
│   ├── middleware/
│   │   ├── authMiddleware.js  # JWT protect()
│   │   └── errorMiddleware.js # Global error handler
│   ├── models/
│   │   ├── User.js
│   │   ├── Resume.js
│   │   ├── InterviewSession.js
│   │   └── Question.js
│   └── routes/
│       ├── authRoutes.js
│       ├── resumeRoutes.js
│       ├── interviewRoutes.js
│       ├── questionRoutes.js
│       └── analyticsRoutes.js
│
├── python_services/           # Flask NLP microservice (own requirements.txt, .env)
│   ├── requirements.txt       # Python dependencies (own manifest, not at repo root)
│   ├── app.py                 # Flask entry point + all routes
│   ├── resume_parser.py
│   ├── semantic_evaluator.py
│   ├── confidence_analysis.py
│   ├── plagiarism_checker.py
│   ├── question_generator.py
│   ├── feedback_generator.py
│   ├── resume_intelligence.py       # candidate level / readiness scoring
│   ├── hybrid_question_generator.py # resume + dataset hybrid question mix
│   ├── followup_generator.py        # adaptive follow-up from keyword coverage
│   ├── coding_questions.py          # static bank of ~15 coding problems + test cases
│   ├── coding_question_generator.py # 60% static / 40% resume-skill-matched selection
│   └── code_followup_generator.py   # adaptive code follow-up (Coding Interview only)
│
├── sample_data/
│   ├── questions.json         # 66 seeded interview questions
│   ├── sample_resume.txt      # Sample resume for testing
│   └── sample_session.json   # Sample session data for seeder
│
├── docs/
│   ├── API.md                 # API reference
│   └── ARCHITECTURE.md       # This file
│
├── tests/
│   ├── python/                # pytest — resume_intelligence.py, hybrid_question_generator.py,
│   │                           #          followup_generator.py, coding_questions.py,
│   │                           #          code_followup_generator.py
│   ├── server/                # Jest + Supertest — health smoke test, interview characterization tests,
│   │                           #        coding-round grading + Coding Interview follow-ups
│   └── client/                # React component tests live in client/src/ (CRA convention); this
│                               # folder is reserved for future integration/e2e tests
│
├── uploads/                   # Resume files (git-ignored)
├── package.json               # Root orchestration scripts only (dev/install/seed/test)
└── README.md
```

Each runtime owns its own dependency manifest and `.env`: `client/package.json`, `server/package.json`
+ `server/.env`, `python_services/requirements.txt` + `python_services/.env`. The root `package.json`
holds no runtime dependencies — only `concurrently` (dev orchestration) and the test runners
(`jest`, `supertest`) used against `tests/server/`.

---

## Technology Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Backend | Node.js + Express | Fast, JSON-native, huge ecosystem |
| Database | MongoDB | Flexible schema for varying session/resume shapes |
| Auth | JWT (stateless) | No session storage needed, scales horizontally |
| NLP service | Python Flask | Best ML/NLP library ecosystem in Python |
| Semantic eval | Sentence-Transformers (pinned `5.6.0`, see `requirements.txt`) | State-of-art embeddings, runs locally, no API cost. The old `2.2.2` pin silently broke (removed `huggingface_hub` API) and fell back to word-overlap similarity — see the note in `CLAUDE.md`. |
| Frontend | React | Component model fits interview screen flow |
| Charts | Recharts | Simple, React-native, no heavy dependencies |
| File upload | Multer | Standard Express file handling |
| Password hashing | bcryptjs | Industry standard, slow by design (resist brute force) |
| Code editor | Monaco (`@monaco-editor/react`) | The actual VS Code editor as a component — real syntax highlighting, and a language selector, for the coding round |
| Code execution (JS) | Node `vm` + `worker_threads` | No Docker/OS-sandbox dependency; best-effort isolation appropriate for a local single-user tool (see the security note in `docs/ARCHITECTURE.md`'s "Coding-Only Sessions" section) |
| Code execution (Python/Java) | `child_process` spawning the system `python` / `javac`+`java` | No sandbox at all (see the security note) — simplest thing that works for a trusted single-user tool; Java's driver uses reflection so it needs no per-question type schema. C isn't offered — no compiler available on this dev machine to build/verify a driver. |
