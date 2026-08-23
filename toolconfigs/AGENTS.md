<!--
  The spine. Installed at the target repo root as AGENTS.md.

  Every other AI-tool config file the installer writes is a pointer to this one, so the
  rules exist once. Replace <PROJECT> and trim rows for capabilities that were not
  installed. Leave a row out rather than pointing at a file that is not there.
-->

# <PROJECT>: Agent Guide

This file is the entry point for any AI coding tool working in this repo. The real content
lives in focused documents under `docs/engineering/`. Read this in full once, then read the
document for the task you are about to do.

Installed from [developer.ai](https://github.com/Ethanon/developer.ai).

---

## Read first, by task

| Task | Required reading |
|---|---|
| Any code change | `docs/engineering/ENGINEERING_PRINCIPLES.md` |
| Writing or reviewing tests | `docs/engineering/TESTING_PRINCIPLES.md` |
| Anything touching auth, input, secrets, logging, or prompts | `docs/engineering/SECURITY_PRINCIPLES.md` |
| Logging, tracing, or debugging | `docs/engineering/OBSERVABILITY_PRINCIPLES.md` |
| Building an agent that calls a model | `docs/engineering/AI_AGENT_PRINCIPLES.md` |
| Architecture and data flow | `docs/ARCHITECTURE.md` |
| Project context, every agent reads this | `docs/PROJECT_CONTEXT.md` |
| Security model | `docs/SECURITY.md` |
| PR lifecycle | `docs/engineering/PR_WORKFLOW.md` |
| Backlog and issue lifecycle | `docs/engineering/BACKLOG_WORKFLOW.md` |
| Debugging this system | `docs/DEBUGGING.md` |

---

## The Prime Directive

> **The preferred number of lines of code is zero.**

Every line is a liability. Write the minimum that correctly solves the problem. When in
doubt, delete. The full anti-patterns and the design-review checklist are in
`docs/engineering/ENGINEERING_PRINCIPLES.md` under "Default to Less" and "Design Review
Checklist".

---

## Headline rules

Each one is a pointer to the full text in `docs/engineering/ENGINEERING_PRINCIPLES.md`.

- **Fail loud, never fabricate.** Critical-path errors surface. No placeholder data, no
  synthetic results, no "graceful degradation" that hides a real failure.
- **No interim implementations.** If the design picked a shape, build that shape.
- **Default to zero comments.** A comment is usually a symptom of an unclear name.
- **Timeouts and intervals never inline.** They come from a config module.
- **Tests are deterministic, offline, and fast.** No real-time waits, no real network.
- **Write so anyone can read it.** Plain language is a rule, not a preference. It applies to
  names, documents, and user-facing text alike.
- **Names never leak a technology.** A name says what a thing is for, not what it is built
  on.
- **Facts before fixes.** Reproduce it before you change code for it.
- **Two failed attempts, look it up. Three, step back.**

---

## What not to do

- Do not use the language's escape hatch to bypass a type error.
- Do not commit secrets. `.env` and `.env.secrets` are gitignored.
- Do not inline timeout, interval, TTL, or retry-count literals outside the config module.
- Do not trust a tenant or account id that arrived in a path, body, or query. Identity comes
  from the session.
- Do not substitute fake or placeholder data when a critical-path operation fails.
- Do not push commits directly to the default branch. Every change opens a pull request.

---

<!-- Keep this section only when reviewer, audit, or backlog agents were installed. -->

## The agent specs

The reviewer, audit, and backlog specs live in `.claude/agents/`.

**That directory name is Claude Code's requirement, not a statement about which tool you
use.** The files are plain markdown. Read them from any tool. The pipeline that runs them on
a schedule uses Claude Code, because that is what the runner action is, and it is
independent of whatever you have open in your editor.
