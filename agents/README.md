# Agents

Every file in this folder is a Claude Code subagent spec: a markdown file whose YAML frontmatter declares an agent name, description, allowed tools, and model, followed by the prose that tells the agent who it is and what to do. The installer copies these into a target repo's `.claude/agents/` folder; Claude Code finds them at runtime.

If you're orienting yourself for the first time, the folder splits three ways:

- **`pr-review/`**: seven agents that fire on every pull request, in two layers. Layer 1 is the first-pass reviewers running in parallel: Alice for security, Bob for engineering principles, Phil for unit-testing discipline, Gomez for line-level clean code, and Carl for UX (only useful when the project has a frontend). Layer 2 runs after Layer 1 finishes: Jekyll and Hyde read the posted reviews and critique them, Jekyll from a best-practices angle and Hyde from an attacker's. Workflow wiring lives in `workflows/pr-review.yml`; the full diagram is in `readme.md`.

- **`backlog/`**: four agents that run on a schedule and manage the issue tracker. `feature_agent` owns one unit of work at a time, drafting a design for the owner to approve before it builds. `scrum_master` closes shipped issues weekly. `story_groomer` decomposes decision docs into stories and applies the `ready` label. `audit_groomer` turns weekly audit reports into pickup-ready issues.

- **`audits/`**: eight read-only scanners that run weekly. `security_audit`, `hanging_refs`, `naming_audit`, `class_size_audit`, `market_watch`, plus three optional ones: `prompt_audit` (projects that ship LLM prompts), `flaky_test_finder` (CI that emits JUnit XML), and `release_audit` (pre-release sweeps). Each writes a timestamped report to `.claude/reports/`; the `audit_groomer` then turns those reports into issues.

Plus one agent at the top level of this folder, with no sub-subfolder of its own: **`installer.md`** runs from a fresh clone of developer.ai itself and walks the adopter through a Q&A wizard to deploy the kit into their target repo. It's the entry point most people use, documented end-to-end in `INSTALL.md`.

## How to read an agent file

Every agent file follows the same shape:

1. **YAML frontmatter**: `name` (used by the orchestrator and slash commands), `description` (what the orchestrator reads to decide when to invoke the agent), `tools` (the list of tools the agent is allowed to call), `model` (which Claude model the agent runs on), and `effort` (the reasoning budget the action gets). The `description` is the most-edited field; the rest changes rarely.
2. **The persona paragraph**. One or two paragraphs at the top in second-person ("You are Alice. A senior security engineer..."). This sets voice and stance.
3. **What you review**: the scope rules naming which files, which diff, and what to read first.
4. **Source of truth**: the docs the agent must consult before forming opinions. This is where the kit's templates (`PROJECT_CONTEXT.md`, `SECURITY.md`, `ARCHITECTURE.md`, `ENGINEERING_PRINCIPLES.md`) get pulled in.
5. **What to look for**: the agent's actual rules, usually as numbered categories.
6. **How to post**: the mechanics of posting a GitHub review or writing a report.
7. **Behavior rules**: invariants (read-only on source, never `REQUEST_CHANGES`, never push to default branch).

If you're tweaking an agent, the section worth editing is usually "What to look for." The rest is stable across the fleet.

## Tag convention inside agent files

Sections that don't apply universally carry an HTML-comment tag:

```markdown
### 9. OAuth login flow integrity
<!-- tag: Architecture-Conditional; applies-when: has-frontend + has-auth -->
```

The installer reads these tags at install time and decides what to do with each section: copy it verbatim, strip it entirely, or replace it with a placeholder paragraph based on the adopter's wizard answers. Four tag values: `Generic`, `Architecture-Conditional`, `Personal Preference`, `Domain-Specific`. The full convention is documented in `readme.md` "The tag convention" and in `agents/installer.md` "Tag-driven file processing".

---

## Full inventory

### PR review pipeline (up to 7 agents)

| Agent | What it does | What you used to do by hand |
|---|---|---|
| Alice (`alice_security.md`) | Security review: routes, auth, secrets, cookies, log-leak hygiene; frontend sections (OAuth, service worker, CSP) when applicable | Manually scan every PR for missing auth middleware, secret leaks, and cookie-flag misses |
| Bob (`bob_engineering.md`) | Engineering review: god classes, naming contracts, fail-loud, over-abstraction; frontend sections when applicable | Catch over-abstraction, naming drift, and structural smells before merge |
| Phil (`phil_testing.md`) | Unit-testing review: test-first signal, intent-first naming, mocking discipline, failure-mode coverage | Check whether the tests actually pin the behavior, or just execute it for coverage |
| Gomez (`gomez_cleancode.md`) | Line-level clean-code review: names that communicate intent, density, idiom | Rename `processData` to something useful; spot the `let` that should be `const` |
| Carl (`carl_ux.md`) | UX review: mobile fit, copy quality, latency masking, studio-quality polish. Skipped for projects with no frontend. | Walk through the diff on a 360-pixel viewport, check tap targets, eyeball loading states |
| Jekyll (`jekyll_whitehat.md`) | Whitehat critic: challenges the first-pass reviews from a best-practices angle | Push back on a reviewer who's about to overfit to a single pattern |
| Hyde (`hyde_blackhat.md`) | Blackhat critic: attacks the first-pass fixes for real bypasses | Stress-test a security fix to see if it actually closes the hole |

Alice and Bob carry their frontend-specific sections inline, tagged Architecture-Conditional. The installer strips them at install time when your project has no frontend.

### Backlog automation (4 agents)

| Agent | What it does | What you used to do by hand |
|---|---|---|
| Feature (`feature_agent.md`) | Owns one unit of work at a time: drafts a design PR, waits for your `design-approved` label, then builds on the same branch and shepherds it through review | Pick the next issue, think through the shape, branch, write the tests, push, open the PR, respond to comments |
| Scrum Master (`scrum_master.md`) | Closes shipped issues, auto-creates tracking issues, cleans up backlog | The Friday backlog-grooming session that nobody enjoys |
| Story Groomer (`story_groomer.md`) | Decomposes decision docs into stories; grades each issue `ready` (design it) or `build-ready` (build it) | Read the latest decision doc and translate "we agreed to do X" into pickup-ready GitHub issues |
| Audit Groomer (`audit_groomer.md`) | Turns weekly audit findings into pickup-ready issues | Read Monday's audit reports and file individual cleanup issues with enough context to pick up |

### Weekly audits (8 agents)

| Agent | What it does | What you used to do by hand |
|---|---|---|
| Hanging Refs (`hanging_refs.md`) | Dead imports, unused exports, orphan routes, stale env vars | Periodically grep for imports that point at deleted files |
| Naming Audit (`naming_audit.md`) | Suffix / contract mismatches against your naming rules | Spot the class named `FooManager` that should be `FooService` (and the other twelve like it) |
| Class Size Audit (`class_size_audit.md`) | Flags classes over 1000 lines of executable code | Scan for the class that grew past the threshold while everyone was focused on features |
| Security Audit (`security_audit.md`) | Auth routes, schema validation, secrets, log-leak, cookie hygiene | A full sweep of the codebase for security drift, the kind that builds up between releases |
| Prompt Audit (`prompt_audit.md`) | (Optional, only if your project ships LLM prompts.) Prompt templates against your prompt-rules doc | Check every prompt template for fragment-loading drift, negative directives in narrative prompts, schema mismatches |
| Flaky Test Finder (`flaky_test_finder.md`) | (Optional, only if your CI emits JUnit XML.) Pulls the last ~100 CI runs, builds a per-test pass/fail histogram, separates flaky from real failures, plus a static-smell scan | Read 100 CI runs by hand to figure out whether that test fails sometimes or all the time |
| Release Audit (`release_audit.md`) | (Optional.) Pre-release sweep: unreleased changes, migration steps, breaking-change surface, deploy-checklist drift | Reconstruct what actually changed since the last tag, and what a deploy needs to do about it |
| Market Watch (`market_watch.md`) | Weekly ecosystem and tooling scan | A Friday afternoon spent reading release notes, blog posts, and HackerNews to see if anything matters this week |

### Installer (1 agent)

| Agent | What it does | What you used to do by hand |
|---|---|---|
| Installer (`installer.md`) | The wizard that puts the kit into your target repo. Invoked via `/install` from a freshly-cloned developer.ai folder. | Copy 14 agent files, edit `REPO_OWNER/REPO_NAME` placeholders, set up workflow YAML, write three calibration docs from scratch |

### Skills (copy to `.claude/skills/` in your project)

**TypeScript** (`skills/typescript/`): receiving-code-review, test-driven-development, code-refactoring, visual-smoke, dev-harness-for-ui-iteration.

**Python** (`skills/python/`): receiving-code-review, test-driven-development, code-refactoring, visual-smoke.

**Any stack** (`skills/common/`): parallel-sessions, for giving each concurrent agent thread its own ports and its own names for anything it starts. Also covers the Windows path limit that makes worktrees undeletable. Ships a working `workspace.mjs` beside it.

The installer copies the language set that matches your stack answer, plus everything in `skills/common/`.

### CI for other platforms (`ci/`)

GitLab, Bitbucket, and Azure DevOps: pipeline files plus a shared posting adapter that
reports a silent agent as a failed job rather than a green one. See
[`ci/README.md`](../ci/README.md) for the review-file contract, what ports, and what does not.

### Tool configuration (`toolconfigs/`)

`AGENTS.md` at your repo root holds the rules; every other tool's file points at it, so they
cannot drift apart. Covers Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, Windsurf,
and Kiro. The installer defaults to writing all of them. See
[`toolconfigs/README.md`](../toolconfigs/README.md) for the install paths and why Copilot is the
one exception to the pointer rule.

### Templates (copy to `docs/` in your project)

| File | What it calibrates |
|---|---|
| `templates/PROJECT_CONTEXT.md` | What this project is. Every agent reads this. Ships with opinionated defaults. |
| `templates/ARCHITECTURE.md` | System shape and layer responsibilities. Bob and the audits read this. |
| `templates/SECURITY.md` | Trust boundaries, sign-in flow, cookies. Alice and security-audit read this. |
| `templates/DEBUGGING.md` | Your project's runbook: symptom decision tree, request path, log commands, and the failure modes that already cost someone an hour. |
| `templates/AGENT_CALIBRATION.md` | Per-reviewer calibration, appended to that reviewer's prompt. What this repo taught it: what to stay quiet about, what to take more seriously, each entry carrying the PRs behind it. |
| `templates/decisions/DECISION_TEMPLATE.md` | Shape of a decision doc, with inline guidance comments. |

### Examples (read for shape, don't copy)

- **`examples/reviews/findings-gallery.md`**: what each reviewer actually catches, as short before/after entries grouped by agent. A few lines of code, the comment that got posted against it, and the one-line reason it lands. Read this first if you want to know whether the output is worth the tokens.
- **`examples/decisions/`**: four worked decision docs in different shapes (security / vendor, layering, philosophy, ops). See `examples/README.md` for the tour.

### Engineering docs (copy to `engineering/` in your project)

- `engineering/ENGINEERING_PRINCIPLES.md`: KISS, SOLID, DRY, YAGNI, naming, failure policy. Pass-through port from a real production codebase, with all rules classified into Generic, Architecture-Conditional, Personal Preference, or Domain-Specific tags so the installer can tailor it to your project.
- `engineering/TESTING_PRINCIPLES.md`: test philosophy, intent-first naming, mocking discipline, failure-mode coverage, flaky-test smells. Phil and `flaky_test_finder` read this.
- `engineering/SECURITY_PRINCIPLES.md`: the portable security rules (input validation, identity binding, prompt-injection boundary, three-tier logging, secrets). Alice and `security_audit` read this. Your project's own answers go in `docs/SECURITY.md`.
- `engineering/AI_AGENT_PRINCIPLES.md`: how to design an agent that calls a model. Whether to build one at all, tool-surface design, memory, prefix stability, evaluation. Only relevant if your project ships its own agents.
- `engineering/OBSERVABILITY_PRINCIPLES.md`: what a log line should contain, correlation ids, trace spans, and the rule against truncating prose. Pairs with `docs/DEBUGGING.md`.
- `engineering/PR_WORKFLOW.md`: opening PRs, greening CI, responding to review.
- `engineering/BACKLOG_WORKFLOW.md`: issue lifecycle, Definition of Ready.

### Reference docs (read; don't copy unless relevant)

- `AGENT_RELIABILITY.md`: the six rules that stop a reviewer job reporting success when it posted nothing, plus the checklist to run before shipping any change to an agent workflow.
- `STYLE.md`: writing-style rules for templates and setup docs.
- `DOMAIN_SPECIFIC.md`: worked examples of patterns that don't apply to every project (turn-based state machines, AI-narrative pipelines, memory strategies). Read the section that matches what you're building.

---
