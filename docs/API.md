# VoxIntel API Reference

All endpoints are prefixed with `/api`.  
Authentication uses **Bearer tokens** in the `Authorization` header.  
All request and response bodies are **JSON** unless noted.

---

## Authentication

### POST `/api/auth/register`
Create a new user account.

**Request body:**
```json
{
  "name": "Arjun Sharma",
  "email": "arjun@example.com",
  "password": "mypassword"
}
```

**Response `201`:**
```json
{
  "message": "Account created successfully",
  "user": { "_id": "...", "name": "Arjun Sharma", "email": "arjun@example.com" },
  "token": "<jwt_token>"
}
```

---

### POST `/api/auth/login`
Sign in with email and password.

**Request body:**
```json
{ "email": "arjun@example.com", "password": "mypassword" }
```

**Response `200`:**
```json
{
  "message": "Login successful",
  "user": { "_id": "...", "name": "Arjun Sharma", "stats": { "totalInterviews": 3, "averageScore": 74 } },
  "token": "<jwt_token>"
}
```

---

### GET `/api/auth/me` 🔒
Get the currently logged-in user.

**Response `200`:**
```json
{ "user": { "_id": "...", "name": "...", "email": "...", "stats": {} } }
```

---

## Resume

### POST `/api/resume/upload` 🔒
Upload a resume file (PDF or DOCX). Triggers async NLP parsing.

**Request:** `multipart/form-data` with field `resume` (file).

**Response `201`:**
```json
{
  "message": "Resume uploaded successfully. Parsing in progress...",
  "resumeId": "64abc123...",
  "status": "uploaded"
}
```

Poll `/api/resume/:id/status` to track parsing progress.

---

### GET `/api/resume` 🔒
List all resumes uploaded by the current user.

**Response `200`:**
```json
{
  "resumes": [
    {
      "_id": "64abc123",
      "originalFilename": "arjun_resume.pdf",
      "status": "parsed",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### GET `/api/resume/:id/status` 🔒
Check parsing status of a specific resume.

**Response `200`:**
```json
{
  "status": "parsed",
  "parsed": {
    "skills": ["react", "python", "mongodb"],
    "technologies": ["mongodb", "docker", "aws"],
    "projects": [{ "name": "VoxIntel", "technologies": ["react", "flask"] }],
    "education": [{ "degree": "B.Tech CSE", "institution": "JNTU", "year": "2024" }],
    "certifications": ["AWS Certified Cloud Practitioner"]
  }
}
```

Status values: `uploaded` → `processing` → `parsed` | `failed`

---

### GET `/api/resume/:id/insights` 🔒
Get the resume intelligence report (candidate level, readiness score, strengths/improvement areas).
If the resume was parsed before intelligence generation existed, this triggers Python's
`/analyze-intelligence` on demand and caches the result.

**Response `200`:**
```json
{
  "candidateLevel": "Intermediate",
  "readinessScore": 72,
  "recommendedDifficulty": "medium",
  "strengths": ["React", "Node.js"],
  "improvementAreas": ["System Design", "Testing"]
}
```

---

## Interview Sessions

### POST `/api/interview/start` 🔒
Start a new mock interview session. Returns all questions for the session.

**Request body:**
```json
{
  "resumeId": "64abc123",
  "role": "Frontend Developer",
  "company": "Google",
  "interviewType": "Technical Interview",
  "difficulty": "medium",
  "questionCount": 10
}
```

`resumeId` is optional. `company` defaults to `"General"`.

**Supported `interviewType` values:**
- `Technical Interview`
- `Frontend Interview`
- `Backend Interview`
- `Coding Interview` / `Coding Round` — coding-only mode, see below
- `AI/ML Interview`
- `System Design Basics`
- `HR Interview`
- `Behavioral Interview`
- `MERN Stack`

**Response `201`:**
```json
{
  "sessionId": "64def456",
  "config": { "role": "Frontend Developer", "company": "Google", "difficulty": "medium" },
  "questions": [
    {
      "index": 0,
      "questionId": "64xyz789",
      "question": "Explain the Virtual DOM in React.",
      "category": "Frontend Development",
      "difficulty": "medium",
      "source": "dataset",
      "followUpQuestions": ["What is React Fiber?"]
    }
  ],
  "candidateIntelligence": {
    "candidateLevel": "Intermediate",
    "readinessScore": 72,
    "recommendedDifficulty": "medium",
    "strengths": ["React"],
    "improvementAreas": ["System Design"]
  },
  "questionSourceDistribution": { "resume": 4, "dataset": 6 }
}
```

If `resumeId` is provided and the resume is parsed, questions are generated **hybrid** (mix of
resume-derived and dataset questions via the Python `/generate-questions-hybrid` endpoint, see
below); otherwise questions come from the dataset only and `candidateIntelligence` is `null`.

#### Coding-only mode (`interviewType: "Coding Interview"` or `"Coding Round"`)

Every question is a hands-on programming problem instead of text Q&A — the dataset/hybrid flow
above doesn't run at all. Questions come from `/generate-coding-questions` (60% from a static
bank, 40% prioritized toward the candidate's resume skills — see `docs/ARCHITECTURE.md`).

The two types differ in exactly one way — whether submissions get an adaptive follow-up
(see `POST /api/interview/answer` below):
- **`Coding Interview`**: every question is follow-up-eligible. After grading, you get a
  question about your approach (complexity, edge cases, optimization) — like a live interviewer.
- **`Coding Round`**: no follow-ups at all — submit, get graded, move on. A straight timed
  assessment.

**Response `201`:**
```json
{
  "sessionId": "64def456",
  "questions": [
    {
      "index": 0,
      "question": "Write a function `twoSum(nums, target)` that returns the indices...",
      "title": "Two Sum",
      "category": "Data Structures & Algorithms",
      "difficulty": "easy",
      "source": "dataset",
      "type": "coding",
      "functionName": "twoSum",
      "starterCode": {
        "javascript": "function twoSum(nums, target) {\n  \n}",
        "python": "def twoSum(nums, target):\n    pass",
        "java": "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        \n    }\n}"
      },
      "testCases": [{ "args": [[2, 7, 11, 15], 9], "expected": [0, 1] }],
      "expectedConcepts": ["hash map", "time complexity"]
    }
  ],
  "config": { "role": "Backend Developer", "company": "General", "difficulty": "easy" },
  "candidateIntelligence": null,
  "questionSourceDistribution": { "resume": 4, "dataset": 6 }
}
```

`starterCode` is a dict keyed by language id — only languages the question actually supports
have a key (three questions with arbitrarily-nested-value arguments don't offer Java; see
`coding_questions.py`). Pick whichever language's editor to show; submit that same key as
`language` in `POST /api/interview/answer` (below). C is not currently offered.

Each question's `hidden_test_cases` are stored server-side only — they're never included in this
response, only used for grading when the candidate submits (see below).

---

### POST `/api/interview/answer` 🔒
Submit and evaluate an answer for a specific question, or an answer to a
previously-generated adaptive follow-up (set `isFollowUp: true`).

**Request body:**
```json
{
  "sessionId": "64def456",
  "questionIndex": 0,
  "userAnswer": "The Virtual DOM is a lightweight copy of the real DOM...",
  "answerMode": "text",
  "timeTakenSeconds": 45,
  "isFollowUp": false
}
```

`answerMode`: `"text"` or `"voice"`. `isFollowUp` defaults to `false` — omit it when
answering the question itself. `confidence.score` is only computed for `answerMode: "voice"`
(it's derived from filler words/hedging/pacing, which have no text-mode equivalent) — a text
answer gets `confidence: { "score": null, ... }` and no confidence line in `feedback`.

**Response `200`** (primary answer):
```json
{
  "scores": {
    "semantic": 88,
    "keyword": 82,
    "completeness": 79,
    "overall": 84
  },
  "confidence": {
    "score": 78,
    "filler_word_count": 1,
    "speech_speed": "normal",
    "feedback": "Confident, direct answer."
  },
  "plagiarism": {
    "score": 5,
    "ai_score": 8,
    "is_original": true,
    "feedback": "Answer appears original."
  },
  "feedback": "Overall performance: good (84/100).\n\nYour answer was semantically good...",
  "followUpQuestion": "You didn't mention \"reconciliation\" — how does that fit into your approach here?"
}
```

`followUpQuestion` is `null` unless this question is follow-up-eligible **and** hasn't
already had one generated. Eligibility: every resume-derived question in the session,
with the first few dataset questions added if fewer than 3 questions are resume-derived
(e.g. no resume was provided) — every session guarantees at least 3 follow-ups. The
follow-up itself is generated by `/generate-followup` (see below) based on which
keywords from the *original* question the answer did or didn't cover — it isn't a
canned string.

When a `followUpQuestion` is returned, submit the candidate's answer to it with the
same `sessionId`/`questionIndex` and `isFollowUp: true`:

**Request body** (follow-up answer):
```json
{
  "sessionId": "64def456",
  "questionIndex": 0,
  "userAnswer": "Reconciliation is React's diffing algorithm that...",
  "isFollowUp": true
}
```

**Response `200`** (follow-up answer) — same shape as a primary answer's response,
minus `followUpQuestion` (follow-ups don't chain further):
```json
{
  "message": "Follow-up answer submitted and evaluated",
  "scores": { "semantic": 81, "keyword": 90, "completeness": 70, "overall": 82 },
  "confidence": { "score": 75 },
  "plagiarism": { "score": 2, "isOriginal": true },
  "feedback": "Overall performance: good (82/100)..."
}
```

Follow-up answers are scored the same way primary answers are, and their scores are
folded into the session's summary (`/api/interview/complete`) as additional graded
items in the parent question's category.

#### Submitting code (coding-only sessions)

Same endpoint, `userAnswer` is the candidate's source in whichever language they picked, plus
a `language` field: `"javascript" | "python" | "java"` (defaults to `"javascript"`; an
unrecognized value also falls back to `"javascript"`). The submitted code is actually run
against the question's test cases — dispatched by `server/services/execution/index.js` to the
matching executor — it is not evaluated by the Python NLP service. Grading is identical
regardless of language: a submission is "correct" if its executor reports all test cases
passed. See `docs/ARCHITECTURE.md`'s "Coding-Only Sessions" security note for how much
sandboxing each language actually gets (JavaScript: a `vm` context; Python/Java: none).

```json
{
  "sessionId": "64def456",
  "questionIndex": 0,
  "userAnswer": "def twoSum(nums, target):\n    ...",
  "language": "python",
  "timeTakenSeconds": 120
}
```

**Response `200`** (primary code submission):
```json
{
  "message": "Code submitted and evaluated",
  "scores": { "semantic": 100, "keyword": 100, "completeness": 100, "overall": 100 },
  "testResults": [
    { "passed": true, "actualOutput": [0, 1], "expectedOutput": [0, 1], "error": null }
  ],
  "hiddenTestSummary": { "passed": 2, "total": 2 },
  "feedback": "All 3 test cases passed! Great work.",
  "followUpQuestion": "Your solution works. Can you explain how \"hash map\" relates to your approach, and what the time complexity is?"
}
```

`scores` are all set to the same value — the percentage of test cases passed (public + hidden).
`testResults` only ever includes the *public* test cases (the ones already shown to the
candidate at `/start`); `hiddenTestSummary` gives a pass count for the hidden ones without
revealing their inputs/expected outputs.

`followUpQuestion` is `null` for `Coding Round` sessions (never eligible) and for questions in a
`Coding Interview` session that already have a follow-up. Otherwise it's generated by
`/generate-code-followup` — a question about complexity/edge cases/optimization if the solution
passed, or about the first *public* failing test case (never a hidden one) if it didn't.

When a `followUpQuestion` is returned, submit the candidate's answer to it **in prose**, not more
code — the same `isFollowUp: true` request shape used for text questions:
```json
{ "sessionId": "64def456", "questionIndex": 0, "userAnswer": "It's O(n) because...", "isFollowUp": true }
```
It's scored via the normal text-evaluation pipeline (`/evaluate-answer`), using the coding
question's `expectedConcepts` as the keyword list in place of a dataset question's authored
keywords/ideal_answer.

---

### POST `/api/interview/complete` 🔒
Mark a session as complete and compute summary scores.

**Request body:**
```json
{ "sessionId": "64def456" }
```

**Response `200`:**
```json
{
  "message": "Interview session completed",
  "sessionId": "64def456",
  "summary": {
    "averageSemanticScore": 79,
    "averageOverallScore": 76,
    "plagiarismFlagged": 0,
    "strongAreas": ["Frontend Development"],
    "weakAreas": ["Backend Development"],
    "overallFeedback": "Good effort! Focus on technical terminology..."
  }
}
```

---

### GET `/api/interview/history` 🔒
Get the last 20 completed sessions for the current user.

**Response `200`:**
```json
{
  "sessions": [
    {
      "_id": "64def456",
      "config": { "role": "Frontend Developer", "company": "Google" },
      "summary": { "averageOverallScore": 76 },
      "status": "completed",
      "startedAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### GET `/api/interview/:sessionId` 🔒
Get full details of a specific session including all answers and scores.

**Response `200`:**
```json
{
  "session": {
    "_id": "64def456",
    "config": {},
    "answers": [
      {
        "question": "...",
        "userAnswer": "...",
        "scores": { "semantic": 88, "keyword": 82, "overall": 84 },
        "feedback": "..."
      }
    ],
    "summary": {}
  }
}
```

---

## Questions

### GET `/api/questions` 🔒
Browse questions with optional filters.

**Query params:**
| Param | Type | Example |
|-------|------|---------|
| `category` | string | `Frontend Development` |
| `difficulty` | string | `medium` |
| `company` | string | `Google` |
| `limit` | number | `10` |

**Response `200`:**
```json
{
  "questions": [
    {
      "_id": "...",
      "question": "What is the Virtual DOM?",
      "category": "Frontend Development",
      "difficulty": "medium",
      "keywords": ["Virtual DOM", "reconciliation"]
    }
  ],
  "total": 10
}
```

---

### GET `/api/questions/categories` 🔒
List all available question categories.

**Response `200`:**
```json
{
  "categories": [
    "Frontend Development",
    "Backend Development",
    "Python Development",
    "MERN Stack",
    "NLP / AI / ML",
    "Data Structures & Algorithms",
    "DBMS",
    "Operating Systems",
    "HR & Behavioral",
    "System Design Basics"
  ]
}
```

---

## Analytics

### GET `/api/analytics/dashboard` 🔒
Get full analytics data for the current user.

**Response `200`:**
```json
{
  "totalInterviews": 5,
  "averageScore": 74,
  "totalQuestions": 42,
  "scoreTrend": [
    { "date": "2024-01-13T...", "score": 68, "role": "Frontend Developer" },
    { "date": "2024-01-15T...", "score": 76, "role": "Python Developer" }
  ],
  "categoryBreakdown": {
    "Frontend Development": 82,
    "Backend Development": 61,
    "Python Development": 77
  },
  "confidenceTrend": [
    { "date": "2024-01-15T...", "confidenceScore": 72 }
  ],
  "plagiarismStats": { "flagged": 0, "total": 42 },
  "weakAreas": ["Backend Development", "Operating Systems"],
  "strongAreas": ["Frontend Development", "HR & Behavioral"],
  "recentSessions": [
    {
      "_id": "...",
      "role": "Frontend Developer",
      "company": "Google",
      "interviewType": "Technical Interview",
      "score": 76,
      "date": "2024-01-15T...",
      "questionsAnswered": 10
    }
  ]
}
```

---

## Python NLP Service (Internal)

The Node.js backend calls these endpoints internally. You don't call them from the frontend directly.

Base URL: `http://localhost:5001`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Health check |
| POST | `/parse-resume` | Parse resume file (multipart); also generates and attaches an intelligence report (see `resume_intelligence.py`) |
| POST | `/evaluate-answer` | Semantic + confidence + plagiarism eval |
| POST | `/analyze-confidence` | Standalone confidence analysis |
| POST | `/check-plagiarism` | Standalone plagiarism check |
| POST | `/generate-questions` | Generate resume-specific questions |
| POST | `/analyze-intelligence` | Generate a candidate intelligence report (`candidateLevel`, `readinessScore`, `recommendedDifficulty`, `strengths`, `improvementAreas`) from an already-parsed resume. Called by `resumeController.getResumeInsights` when a cached intelligence report doesn't exist yet. See `resume_intelligence.py`. |
| POST | `/generate-questions-hybrid` | Generate a hybrid question set — 50% resume-derived, 50% dataset — from parsed resume data, an intelligence report, and a pool of dataset questions. Called by `interviewController.startSession` (now `sessionController.startSession`), with a dataset-only fallback if this call fails. Returns `{ questions, count, distribution: { resume, dataset } }`. See `hybrid_question_generator.py`. |
| POST | `/generate-followup` | Generate an adaptive follow-up question from `{ user_answer, keywords }`, based on which keywords the answer did or didn't cover (no generative model involved — template-based). Called by `answerController.submitAnswer` for follow-up-eligible questions. Returns `{ question, based_on }`. See `followup_generator.py`. |
| POST | `/generate-coding-questions` | Select coding problems from `{ skills, count }` — 60% from the static bank, 40% prioritized toward skill-matched problems (falls back to the rest of the bank if there aren't enough matches). Called by `sessionController.startCodingSession`. Returns `{ questions, count }`, each including `hidden_test_cases` that Node strips before responding to the frontend. See `coding_question_generator.py` / `coding_questions.py`. |
| POST | `/generate-code-followup` | Generate an adaptive follow-up for a coding submission from `{ passed_count, total_count, expected_concepts, first_public_failure }` — an optimization/complexity question if it passed, an edge-case question referencing the first *public* failure if it didn't (never a hidden one). Called by `answerController.submitCodeAnswer`, only for `Coding Interview` sessions (every question is follow-up-eligible there; `Coding Round` questions never are). Returns `{ question, based_on }`. See `code_followup_generator.py`. |
| GET | `/company-context?company=Google` | Get company interview style notes |

---

## Error Responses

All errors follow this format:

```json
{ "error": "Human-readable error message" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request — missing or invalid fields |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — not your resource |
| 404 | Not found |
| 429 | Too many requests (rate limited) |
| 500 | Internal server error |

---

## Rate Limiting

All `/api/*` routes are limited to **100 requests per 15 minutes per IP**.  
Exceeding this returns `429 Too Many Requests`.

---

## Authentication Header

All 🔒 routes require:

```
Authorization: Bearer <your_jwt_token>
```

The token is returned from `/api/auth/login` and `/api/auth/register`.
