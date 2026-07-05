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
- `Coding Round`
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

---

### POST `/api/interview/answer` 🔒
Submit and evaluate an answer for a specific question.

**Request body:**
```json
{
  "sessionId": "64def456",
  "questionIndex": 0,
  "userAnswer": "The Virtual DOM is a lightweight copy of the real DOM...",
  "answerMode": "text",
  "timeTakenSeconds": 45
}
```

`answerMode`: `"text"` or `"voice"`

**Response `200`:**
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
  "feedback": "Overall performance: good (84/100).\n\nYour answer was semantically good..."
}
```

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
| POST | `/generate-questions-hybrid` | Generate a hybrid question set — ~60% resume-derived, ~40% dataset — from parsed resume data, an intelligence report, and a pool of dataset questions. Called by `interviewController.startSession`, with a dataset-only fallback if this call fails. Returns `{ questions, count, distribution: { resume, dataset } }`. See `hybrid_question_generator.py`. |
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
