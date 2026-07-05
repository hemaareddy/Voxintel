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
                              └──────────────────────────┘
```

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
  │      ~60% resume-derived / ~40% dataset; falls back to dataset-only on failure)
  │   Else: shuffle dataset pool and slice to questionCount
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
  └─ Return scores + feedback to frontend
        │
        ▼
Frontend: show per-answer scores, next question
        │
All questions answered
        │
        ▼
POST /api/interview/complete
  ├─ Aggregate scores across all answers
  ├─ Compute averages: semantic, overall, confidence
  ├─ Identify strong areas (avg ≥ 70) and weak areas (avg < 50)
  ├─ Update InterviewSession.summary
  ├─ Update User.stats cache
  └─ Return summary → navigate to /results
```

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
│   │   └── pythonNlpClient.js # All axios calls to the Python NLP service, in one place
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
│   └── hybrid_question_generator.py # resume + dataset hybrid question mix
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
│   ├── python/                # pytest — resume_intelligence.py, hybrid_question_generator.py
│   ├── server/                # Jest + Supertest — health smoke test, interview characterization tests
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
| Semantic eval | Sentence-Transformers | State-of-art embeddings, runs locally, no API cost |
| Frontend | React | Component model fits interview screen flow |
| Charts | Recharts | Simple, React-native, no heavy dependencies |
| File upload | Multer | Standard Express file handling |
| Password hashing | bcryptjs | Industry standard, slow by design (resist brute force) |
