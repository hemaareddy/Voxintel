# VoxIntel — AI-Assisted Interview Preparation Platform

A beginner-friendly, modular platform that helps students and job seekers practice
technical interviews with AI-powered feedback, semantic evaluation, and analytics.

---

## Features

- Resume upload and NLP-based skill extraction
- Role/company-specific question generation (66 seeded questions across 10 domains, plus resume-derived hybrid generation)
- Coding-only interview mode (Monaco code editor, real code execution against test cases,
  solvable in JavaScript, Python, or Java — any one of them graded as correct)
- Adaptive follow-up questions based on keyword coverage in your answer
- Mock interview with text + voice input
- Semantic answer evaluation (sentence-transformer embeddings + cosine similarity)
- Confidence analysis (speech speed, pauses, filler words)
- Plagiarism & AI-generated response detection
- Analytics dashboard (trends, weak areas, history)
- Company-specific interview mode (Google, Amazon, TCS, etc.)
- Interview lockdown: fullscreen enforcement + tab/window-switch detection, with a
  warning on the first violation and automatic session-end on the second

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js + plain CSS |
| Backend | Node.js + Express.js |
| Database | MongoDB (Mongoose) |
| NLP Services | Python + Flask microservice |
| NLP Libs | SpaCy, NLTK, Sentence-Transformers, Scikit-learn |

---

## Project Structure

```
VoxIntel/
├── client/               # React frontend (own package.json)
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── pages/        # Route-level pages
│       ├── styles/       # CSS files
│       └── utils/        # Helper functions
├── server/               # Node/Express backend (own package.json, .env)
│   ├── routes/           # API route definitions
│   ├── controllers/      # Business logic
│   │   └── interview/    # Session / answer / completion controllers
│   ├── services/         # pythonNlpClient.js — all calls to the Python service
│   ├── models/           # Mongoose schemas
│   ├── middleware/       # Auth, validation, error handling
│   └── config/           # DB and environment config
├── python_services/      # Python NLP Flask API (own requirements.txt, .env)
│   ├── requirements.txt  # Python dependencies
│   ├── app.py            # Flask entry point
│   ├── resume_parser.py
│   ├── semantic_evaluator.py
│   ├── confidence_analysis.py
│   ├── plagiarism_checker.py
│   ├── question_generator.py
│   ├── feedback_generator.py
│   ├── resume_intelligence.py       # candidate level / readiness scoring
│   └── hybrid_question_generator.py # resume + dataset hybrid question mix
├── sample_data/          # Question database JSON
├── tests/                # tests/python, tests/server, tests/client
└── package.json          # Root orchestration scripts only (dev/install/seed/test)
```

---

## Quick Start

### Prerequisites
- Node.js >= 18
- Python >= 3.9
- MongoDB (local or Atlas URI)
- To grade coding-round submissions in Python or Java, the server also needs
  a system `python` and a JDK (`javac`/`java`) on `PATH` — separate from the
  `python_services/.venv` used for the NLP service. Without these, candidates
  can still solve coding questions in JavaScript; picking Python/Java without
  the matching toolchain installed returns a clear "interpreter/compiler not
  found" grading error instead of a crash. C isn't offered as a language
  option at all (no C compiler dependency in this project).

### 1. Clone & install

```bash
git clone <repo-url>
cd VoxIntel
npm run install:all         # installs root, server/, and client/ dependencies
```

### 2. Backend (Node)

```bash
cd server
cp .env.example .env        # fill in your values
cd ..
npm run server               # starts on :5000
```

### 3. Python NLP Service

Use a virtual environment on a Python version with prebuilt `spacy`/`scikit-learn`/
`sentence-transformers` wheels available (3.10–3.12 as of writing — very new Python
releases often don't have wheels yet and will fail to build `blis` from source).

```bash
cd python_services
py -3.12 -m venv .venv       # or `python3.12 -m venv .venv` outside Windows
cp .env.example .env        # optional — sensible defaults are used if unset
.venv/Scripts/python.exe -m pip install -r requirements.txt   # .venv/bin/python on macOS/Linux
.venv/Scripts/python.exe -m spacy download en_core_web_sm
.venv/Scripts/python.exe app.py               # starts on :5001
```

`npm run python` / `npm run dev` already invoke `python_services\.venv\Scripts\python.exe`
directly (Windows path — the npm scripts in this repo assume a Windows dev machine), so
once the venv above is set up, `npm run dev` picks it up automatically. On macOS/Linux,
edit the `"python"` script in the root `package.json` to point at `.venv/bin/python`
instead, or just run `python_services/.venv/bin/python app.py` manually.

If `spacy download` fails to resolve a model version (a malformed download URL), install
the model wheel directly instead:
`.venv/Scripts/python.exe -m pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl`

### 4. Frontend (React)

```bash
cd client
npm install
npm start                   # starts on :3000
```

For a production build served from a different origin than the API, copy
`client/.env.production.example` to `client/.env.production` and set `REACT_APP_API_URL`.

---

## Environment Variables

Each service owns its own `.env`, matching what actually consumes each variable:

- `server/.env` (copy from `server/.env.example`) — `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
  `PORT`, `NODE_ENV`, `MAX_FILE_SIZE_MB`, `BCRYPT_ROUNDS`, `CLIENT_URL` (CORS allow-list), and
  `PYTHON_SERVICE_URL` (the address the server calls out to — default `http://localhost:5001`)
- `python_services/.env` (copy from `python_services/.env.example`) — `FLASK_HOST`, `FLASK_PORT`
  (both optional; sensible defaults are used if unset)
- `client/.env.production` (copy from `client/.env.production.example`) — `REACT_APP_API_URL`,
  only needed for a production build served from a different origin than the API

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| POST | /api/resume/upload | Upload & parse resume |
| POST | /api/interview/start | Start mock interview session |
| POST | /api/interview/answer | Submit answer for evaluation |
| GET  | /api/interview/history | Get past sessions |
| GET  | /api/analytics/dashboard | Get analytics data |
| POST | /api/questions/generate | Generate questions |

---

## Sample Users (for testing)

After seeding: `npm run seed`

- Email: `demo@voxintel.com` / Password: `demo1234`

---

## Future Improvements

- Local LLM integration (Ollama)
- Async job queue (Bull/Redis)
- Advanced emotion analysis
- Personalized learning paths
- Mobile app (React Native)
