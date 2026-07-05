# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repository.

## What this is

VoxIntel is an AI-assisted mock-interview platform: users upload a resume, start a
mock interview tailored to a role/company, answer questions (text or voice), and get
semantic scoring, confidence analysis, plagiarism/AI-detection, and analytics.
`interviewType: "Coding Interview"` / `"Coding Round"` sessions are a separate mode:
every question is a hands-on programming problem solved in an in-browser Monaco editor,
graded by actually running the submitted code (see the security note below). The two
types differ in exactly one way: `Coding Interview` marks every question follow-up-eligible
(an adaptive question about complexity/edge cases/optimization after each submission,
answered in prose); `Coding Round` never does — a straight timed assessment. That's the
only difference — don't assume there's more to it, and if you add a second behavioral
difference, update `CODING_TYPES_WITH_FOLLOWUPS` in `sessionController.js` plus this note.

Three independently-runnable services, each with its own manifest and `.env`:

| Service | Stack | Port | Manifest | Env file |
|---|---|---|---|---|
| `client/` | React 18 (CRA) + react-router-dom + recharts + axios | 3000 | `client/package.json` | `client/.env.production` (prod builds only) |
| `server/` | Node 18+ / Express 4 + Mongoose (MongoDB) + JWT | 5000 | `server/package.json` | `server/.env` |
| `python_services/` | Python / Flask 3 + spaCy, NLTK, Sentence-Transformers, scikit-learn | 5001 | `python_services/requirements.txt` | `python_services/.env` (optional) |

The root `package.json` holds **no runtime dependencies** — only `concurrently` (dev
orchestration) and `jest`/`supertest` (used against `tests/server/`). Don't add
Express/Mongoose/etc. back to the root manifest; they belong in `server/package.json`.

## Architecture: deterministic vs. AI-assisted

The codebase deliberately separates two kinds of logic (see `docs/ARCHITECTURE.md` for
full diagrams):

- **Deterministic** (Node/`server/`): auth, file upload/storage, DB reads/writes,
  question selection, session lifecycle, score aggregation, API routing/validation.
- **AI-assisted** (Python/`python_services/`): resume parsing, semantic answer
  evaluation, confidence analysis, plagiarism/AI-content detection, feedback
  generation, resume intelligence scoring, hybrid question generation, adaptive
  follow-up generation, coding-problem selection.
- **Coding-round grading** is neither of the above in the usual sense: it's
  deterministic (Node-side, no NLP) but not a simple DB read either — it actually
  *executes* the candidate's code. See the security note immediately below before
  touching `server/services/execution/` or `server/services/codeExecution*.js`.

Question generation is a 50/50 mix of resume-derived and dataset questions
(`hybrid_question_generator.py`). There's no generative LLM in this stack — adaptive
follow-up questions (`followup_generator.py`) are template-based, reacting to which
keywords the candidate's answer did or didn't cover, not free-form generated text.
Every session guarantees at least 3 follow-ups (resume-derived questions are eligible
first; dataset questions fill in if fewer than 3 are resume-derived).

### ⚠️ Code execution sandbox — read before touching `codeExecution*.js` / `execution/`

Coding-round questions can be solved in **JavaScript, Python, or Java** — the
candidate picks a language in the editor, and `server/services/execution/index.js`
dispatches grading to the matching executor. "Correct" just means "the chosen
language's executor reports all test cases passed"; there's no cross-language
scoring difference.

- **JavaScript** (`server/services/codeExecutionService.js`) runs candidate code
  inside a `worker_thread` + restricted `vm` context. This is a **best-effort
  sandbox for a trusted, single-user local dev tool** — Node's own docs say `vm`
  is not a security boundary against determined adversarial code. It's currently
  reasonably defended (verified in `tests/server/codeExecutionService.test.js`):
  the classic Function-constructor escape is blocked, `process`/`require`/filesystem
  aren't exposed, infinite loops are killed by a timeout.
- **Python** (`server/services/execution/pythonExecutor.js`) and **Java**
  (`server/services/execution/javaExecutor.js`) have **no sandbox at all** —
  they spawn the real `python` interpreter / `javac`+`java` as ordinary OS
  child processes with full filesystem/network access, same as running the
  code yourself in a terminal. This is a bigger trust concession than the JS
  `vm` path, only defensible because the whole feature is single-local-user
  (the candidate is grading their own code on their own machine).
- Java's driver (`server/services/execution/templates/JavaDriver.template.java`)
  is generic: it finds the candidate's method via reflection and coerces JSON
  test-case args to whatever types that method declares, so it never needs to
  know a question's argument shapes ahead of time. Verified directly (compiled
  + run standalone, not just through Jest) against int[]/String/boolean args,
  generic `Object`/`Map`/`List` args (for the 3 questions with arbitrarily-nested
  values), thrown exceptions, and a missing-method case.
- **C is intentionally not offered** — this dev environment has no C compiler
  (gcc/MinGW) to build and verify a driver against, and shipping an untested
  compile/execute path for a *grading* feature is worse than not having it. If
  a compiler becomes available, `execution/index.js` is the dispatch point to
  add a `cExecutor.js`.

None of the three are hardened for public/multi-tenant traffic — don't remove
the JS worker-thread isolation, don't widen its exposed globals without
re-verifying the escape tests still pass, and don't wire any of this up behind
a public-facing endpoint without adding real OS-level isolation (Docker with
dropped capabilities, gVisor, Firecracker) first. Full details in
`codeExecutionWorker.js`'s header comment and `docs/ARCHITECTURE.md`'s
"Coding-Only Sessions" section.

**Node never calls the Python service directly with axios.** All calls go through
`server/services/pythonNlpClient.js`. If you add a new Python endpoint, add a
corresponding function there and call that from the controller — don't scatter new
`axios.post(PYTHON_URL, ...)` calls across controllers.

`server/controllers/interview/` is split by concern: `sessionController.js` (start,
get, history), `answerController.js` (submit + evaluate one answer), and
`completionController.js` (finish a session, aggregate scores, update user stats).
Keep new interview-related logic in the file that matches its concern rather than
growing one of these back into a monolith.

### Interview lockdown (anti-cheating)

`InterviewPage.jsx` gates the actual interview behind a "Ready to begin?" click —
entering fullscreen needs a user gesture, so this is also where the candidate agrees
to the rules. Once started, it listens for `visibilitychange`, `window.blur`, and
`fullscreenchange` (browsers can't actually *prevent* tab/window switching — no site
can block Alt+Tab — so this is detection-and-react, not real prevention). First
violation shows a warning modal; a second calls `handleComplete("tab-switch")`, which
scores whatever was answered so far and redirects to `/results` with
`terminatedReason: "tab-switch"` in navigation state (`ResultsPage.jsx` shows a banner
for it). Violations are debounced (1.5s) since a single tab-switch often fires
`blur` and `fullscreenchange` together — don't remove the debounce or near-simultaneous
events will double-count as two violations instead of one. This is entirely
client-side; there's no server-side record of violations. `Navbar.jsx` also hides
itself entirely on `/interview` — a persistent navbar would be a one-click escape
hatch to Dashboard/Resume that defeats the whole lockdown.

### Confidence analysis is voice-only

`confidence_analysis.py`'s score is derived purely from text patterns (filler
words, hedging, brevity) — it's meaningful for voice answers (where those
patterns reflect actual speech), but a typed text answer has no equivalent
signal. `app.py`'s `/evaluate-answer` only calls `analyze_confidence()` when
`answer_mode == "voice"`; for text it returns `{"score": None, ...}`. Both the
client's confidence progress bar (`InterviewPage.jsx`, `ResultsPage.jsx`) and
`feedback_generator.py`'s `_confidence_section()` already skip rendering when
`score` is `None` — don't reintroduce a numeric confidence score for text mode,
it will resurface as a misleading number rather than a missing one.

`semantic_evaluator.py`'s `evaluate_answer()` also caps (never raises) the
semantic score based on how many non-stopword "content words" the answer
contains (`_content_word_count`) — a near-empty or gibberish answer ("k", "idk")
can otherwise land a deceptively decent SBERT cosine similarity (~30-40%) purely
because a very short/out-of-vocabulary embedding isn't far from *everything* in
embedding space, not because the answer is any good.

## Running the project

```bash
npm run install:all   # installs root, server/, and client/ deps
npm run dev            # runs server + client + python concurrently
npm run seed            # seeds MongoDB from sample_data/questions.json
```

Individually: `npm run server` (Node, nodemon), `npm run client` (React dev server),
`npm run python` (Flask). See `.claude/skills/dev-workflow/SKILL.md` for the full
day-to-day workflow, including per-service `.env` setup.

`npm run python` invokes `python_services/.venv/Scripts/python.exe` directly (not the
system `python`) — the Python NLP dependencies (spaCy, sentence-transformers,
scikit-learn) need a venv on a Python version with prebuilt wheels available (3.10–3.12
as of writing); very new Python releases often lack wheels and fail to build `blis`
from source. Create it once with `py -3.12 -m venv python_services/.venv`.

`sentence-transformers` is pinned to `5.6.0`, not the older `2.2.2` you might see
referenced elsewhere — `2.2.2` calls `huggingface_hub`'s long-removed `cached_download`,
which fails *silently* (`semantic_evaluator.py` catches the ImportError and falls back to
crude word-overlap similarity) rather than crashing loudly. If semantic scores ever look
suspiciously flat/near-zero across very different answers, check
`python_services/.venv`'s installed `sentence-transformers`/`huggingface_hub` versions
before assuming the evaluation logic itself is broken.

## Testing

```bash
npm test              # runs server, python, and client suites in sequence
npm run test:server    # Jest + Supertest, tests/server/
npm run test:python    # pytest, tests/python/
npm run test:client    # react-scripts test, client/src/**/*.test.js
```

Test coverage is intentionally a scaffold, not comprehensive, though the code execution
sandbox and coding-round grading are exercised thoroughly given the security stakes
(`tests/server/codeExecutionService.test.js` runs real code through the real sandbox —
including an infinite-loop and a sandbox-escape attempt — rather than mocking it).
`tests/python/` covers `resume_intelligence.py`, `hybrid_question_generator.py`, and
`coding_questions.py`; `tests/server/` has characterization tests for the interview
controllers plus the coding-round path; `client/src/*.test.js` covers the app shell,
the adaptive follow-up flow, and the coding-round editor UI (Monaco is mocked there —
jsdom lacks the browser APIs it needs). When adding a feature to an area that already
has tests, extend the existing suite rather than leaving it stale — that gap (docs and
tests silently falling behind the code) is exactly the kind of drift this repo has had
trouble with before (see "Keeping docs in sync" below).

CRA hardcodes its Jest `roots` to `client/src/` — new client component tests must live
there (e.g. `client/src/pages/Foo.test.js`), not under `tests/client/`, or CRA's test
runner will silently never find them.

## Conventions (per ecosystem — don't force cross-ecosystem consistency)

- Mongoose models: PascalCase (`User.js`, `InterviewSession.js`)
- Express routes/controllers: camelCase (`authRoutes.js`, `resumeController.js`)
- Python modules: snake_case (`resume_parser.py`, `hybrid_question_generator.py`)

These differ because each matches its own language's idiom — that's intentional, not
inconsistency to "fix."

## Keeping docs in sync

`docs/API.md` and `docs/ARCHITECTURE.md` previously drifted out of sync with the code:
two Python modules (`resume_intelligence.py`, `hybrid_question_generator.py`) and
their endpoints (`/analyze-intelligence`, `/generate-questions-hybrid`) existed in
code, were actively called from `server/controllers/`, but were undocumented. When you
add a new Python service module or endpoint, update both docs in the same change —
don't let this happen again.

## Environment variables

Each service owns its `.env` — don't reintroduce a shared root `.env`:

- `server/.env`: `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `NODE_ENV`,
  `MAX_FILE_SIZE_MB`, `BCRYPT_ROUNDS`, `CLIENT_URL` (CORS allow-list),
  `PYTHON_SERVICE_URL` (address the server calls out to)
- `python_services/.env` (optional): `FLASK_HOST`, `FLASK_PORT`
- `client/.env.production` (prod builds only): `REACT_APP_API_URL`

`server/index.js` and `server/config/seed.js` both load dotenv with an explicit
`path: path.join(__dirname, ...)` pointing at `server/.env` — this is intentional so
they work regardless of the process's current working directory. Don't change these
back to bare `dotenv.config()`.
