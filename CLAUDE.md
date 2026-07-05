# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repository.

## What this is

VoxIntel is an AI-assisted mock-interview platform: users upload a resume, start a
mock interview tailored to a role/company, answer questions (text or voice), and get
semantic scoring, confidence analysis, plagiarism/AI-detection, and analytics.

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
  generation, resume intelligence scoring, hybrid question generation.

**Node never calls the Python service directly with axios.** All calls go through
`server/services/pythonNlpClient.js`. If you add a new Python endpoint, add a
corresponding function there and call that from the controller — don't scatter new
`axios.post(PYTHON_URL, ...)` calls across controllers.

`server/controllers/interview/` is split by concern: `sessionController.js` (start,
get, history), `answerController.js` (submit + evaluate one answer), and
`completionController.js` (finish a session, aggregate scores, update user stats).
Keep new interview-related logic in the file that matches its concern rather than
growing one of these back into a monolith.

## Running the project

```bash
npm run install:all   # installs root, server/, and client/ deps
npm run dev            # runs server + client + python concurrently
npm run seed            # seeds MongoDB from sample_data/questions.json
```

Individually: `npm run server` (Node, nodemon), `npm run client` (React dev server),
`npm run python` (Flask). See `.claude/skills/dev-workflow/SKILL.md` for the full
day-to-day workflow, including per-service `.env` setup.

## Testing

```bash
npm test              # runs server, python, and client suites in sequence
npm run test:server    # Jest + Supertest, tests/server/
npm run test:python    # pytest, tests/python/
npm run test:client    # react-scripts test, client/src/**/*.test.js
```

Test coverage is intentionally a scaffold, not comprehensive: `tests/python/` covers
`resume_intelligence.py` and `hybrid_question_generator.py` in depth; `tests/server/`
has a health-check smoke test plus characterization tests for the interview
controllers; `client/src/App.test.js` is a single rendering smoke test. When adding
a feature to an area that already has tests, extend the existing suite rather than
leaving it stale — that gap (docs and tests silently falling behind the code) is
exactly the kind of drift this repo has had trouble with before (see "Keeping docs in
sync" below).

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
