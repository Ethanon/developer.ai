---
inclusion: always
---

# Engineering principles

Read `AGENTS.md` at the repo root before any change, and the document under
`docs/engineering/` that covers what you are about to do.

The Prime Directive: the preferred number of lines of code is zero. Write the minimum that
correctly solves the problem, and delete when in doubt.

Non-negotiable:

- Fail loud, never fabricate. No placeholder data on a critical path.
- Default to zero comments. A comment is usually a symptom of an unclear name.
- No timeout, interval, TTL, or retry literal outside the config module.
- Identity comes from the session, never from a path, body, or query parameter.
- Names never leak a technology.
- Tests are deterministic, offline, and fast.
- Reproduce a defect before changing code for it.

When writing a spec under `.kiro/specs/`, the acceptance criteria follow the Definition of
Ready in `docs/engineering/BACKLOG_WORKFLOW.md`.
