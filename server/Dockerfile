# server/Dockerfile
#
# Base Node image, plus a bare Python 3 interpreter and a JDK installed
# alongside it. The coding-round grader (services/execution/pythonExecutor.js,
# javaExecutor.js) spawns `python` / `javac` / `java` as child processes to
# run candidate-submitted code for Python/Java coding questions — a plain
# Node buildpack has neither, so those languages would fail every test case
# with a clear "interpreter/compiler not found" error (see CLAUDE.md's
# code-execution-sandbox note). This is unrelated to python_services/, which
# is a separate deployed Flask service for NLP evaluation.
#
# SECURITY NOTE: this still runs submitted Python/Java with no sandbox beyond
# what the OS/container gives you — same caveat as CLAUDE.md/ARCHITECTURE.md
# already document for local dev. Deploying this publicly means arbitrary
# candidate-submitted code executes as this container's user. Acceptable for
# a personal/low-traffic deployment; do not scale this to untrusted public
# traffic without adding real per-submission isolation (gVisor, Firecracker,
# or a separate sandboxed execution service).
FROM node:18-slim

# python3 — Debian doesn't alias `python` to `python3` by default, so the
# executor is told to use `python3` via PYTHON_EXEC_BIN below.
# default-jdk-headless — provides javac + java on PATH.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 default-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PYTHON_EXEC_BIN=python3

EXPOSE 5000

CMD ["node", "index.js"]
