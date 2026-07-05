---
name: dev-workflow
description: Day-to-day workflow for running, seeding, and testing VoxIntel's three services (client, server, python_services) locally.
---

# VoxIntel dev workflow

## First-time setup

```bash
npm run install:all   # installs root, server/, and client/ node_modules

cd python_services
py -3.12 -m venv .venv   # pick a Python version with prebuilt spacy/scikit-learn/
                          # sentence-transformers wheels (3.10-3.12 as of writing) —
                          # very new Python releases often lack wheels and fail to
                          # build `blis` from source
.venv/Scripts/python.exe -m pip install -r requirements.txt   # .venv/bin/python on macOS/Linux
.venv/Scripts/python.exe -m spacy download en_core_web_sm
cd ..
```

If `spacy download` fails with a malformed download URL, install the model wheel
directly: `.venv/Scripts/python.exe -m pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl`

Copy each service's env template and fill in values (defaults work for local dev
against a local MongoDB):

```bash
cp server/.env.example server/.env
cp python_services/.env.example python_services/.env   # optional — has defaults
```

`client/` needs no `.env` for local dev — the CRA dev server proxy (`client/package.json`
`"proxy"`) forwards `/api` to `localhost:5000` automatically. `client/.env.production.example`
only matters when building for a deployment where the API lives on a different origin.

## Running the app

```bash
npm run dev        # starts server (nodemon) + client (CRA) + python (Flask) together
```

Or individually, useful when you only need to iterate on one service:

```bash
npm run server     # Node/Express on :5000, via nodemon
npm run client     # React dev server on :3000
npm run python     # Flask NLP service on :5001 (runs python_services/.venv/Scripts/python.exe)
```

Requires a running MongoDB instance reachable at `server/.env`'s `MONGO_URI`.

## Seeding the database

```bash
npm run seed
```

Loads `sample_data/questions.json` (66 questions) and creates a demo user
(`demo@voxintel.com` / `demo1234`) via `server/config/seed.js`.

## Running tests

```bash
npm test              # server + python + client, in sequence
npm run test:server    # Jest + Supertest — tests/server/
npm run test:python    # pytest — tests/python/ (requires requirements.txt installed)
npm run test:client    # react-scripts test — client/src/**/*.test.js
```

`tests/server/` tests stub Mongoose models and axios — they don't need a live MongoDB
or Python service. New React component tests must live under `client/src/` (CRA's
Jest config hardcodes its test root there); `tests/client/` is reserved for future
integration/e2e tests.

## Adding a new Python NLP endpoint

1. Add the route + handler in `python_services/app.py` (or a new module it imports).
2. Add a corresponding function to `server/services/pythonNlpClient.js` — don't call
   `axios` directly from a controller.
3. Update `docs/API.md`'s "Python NLP Service (Internal)" table and
   `docs/ARCHITECTURE.md` if it changes a workflow diagram.
