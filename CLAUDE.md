# developer.ai: Agent Guide

This file is the entry point. Real content lives in focused docs under `engineering/`. Read those for the rule you need.

If you are an agent: read this in full once, then read the linked doc(s) for the task you are about to do.

---

## What this is

**developer.ai gives one developer an entire engineering organization, as agents.** It is a public collection of agent specs, engineering principles, automation workflows, and CI pipelines for four platforms. Fork it, configure it for your repo, and the functions a real org performs start running on a schedule.

The developer stays the architect. Every other seat is filled:

- **Development.** `feature_agent` designs before it builds, waits for your approval, then writes tests first and implements to green. Skills give it test-driven development, refactoring discipline, a dev harness, and visual smoke that drives a real browser.
- **Review.** Seven reviewers in two waves, each in a lane, with a whitehat and blackhat pair that critique the first wave rather than repeat it.
- **Platform and ops.** Eight weekly scanners for the drift nobody schedules time to look for.
- **PM and scrum.** Four backlog agents that turn decisions into stories ready to pick up, by you or by an agent.

Every one of these runs on a schedule or a trigger rather than on your attention, so the work happens whether or not you remembered to ask for it.

Each agent is one file. Frontend-specific rules live inline, tagged Architecture-Conditional, and the installer keeps or strips them based on whether your project has a frontend.

See [ADAPTING.md](ADAPTING.md) for the one-time setup steps to point everything at your repo.

---

## Read first, by task

| Task | Required reading |
|---|---|
| Any code change | [`engineering/ENGINEERING_PRINCIPLES.md`](engineering/ENGINEERING_PRINCIPLES.md) |
| Writing or reviewing tests | [`engineering/TESTING_PRINCIPLES.md`](engineering/TESTING_PRINCIPLES.md) |
| Anything touching auth, input, secrets, logging, or prompts | [`engineering/SECURITY_PRINCIPLES.md`](engineering/SECURITY_PRINCIPLES.md) |
| Architecture / data flow | `docs/ARCHITECTURE.md` (add your own) |
| Changing an agent or a review workflow | [`AGENT_RELIABILITY.md`](AGENT_RELIABILITY.md) |
| Measuring whether the fleet is accurate | [`BENCHMARKING.md`](BENCHMARKING.md) |
| Logging, tracing, or debugging | [`engineering/OBSERVABILITY_PRINCIPLES.md`](engineering/OBSERVABILITY_PRINCIPLES.md) |
| Building an agent that calls a model | [`engineering/AI_AGENT_PRINCIPLES.md`](engineering/AI_AGENT_PRINCIPLES.md) |
| AI agents (all roles, variants) | [`agents/`](agents/) |
| PR lifecycle | [`engineering/PR_WORKFLOW.md`](engineering/PR_WORKFLOW.md) |
| Backlog / issue lifecycle | [`engineering/BACKLOG_WORKFLOW.md`](engineering/BACKLOG_WORKFLOW.md) |
| Adapting this repo to your project | [`ADAPTING.md`](ADAPTING.md) |
| Adding your own agents | [`KIT_EXTEND.md`](KIT_EXTEND.md) |

---

## The Prime Directive

> **The preferred number of lines of code is zero.**

Every line is a liability. Write the minimum that correctly solves the problem. When in doubt, delete. Full anti-patterns and the design-review checklist live in [`engineering/ENGINEERING_PRINCIPLES.md`](engineering/ENGINEERING_PRINCIPLES.md) → "Default to Less" and "Design Review Checklist".

---

## Headline rules: the ones agents violate most often

Each rule below is a pointer to the full text in [`engineering/ENGINEERING_PRINCIPLES.md`](engineering/ENGINEERING_PRINCIPLES.md).

- **Fail loud, never fabricate.** Critical-path errors throw; client retries. No placeholder data, no synthetic ops, no "graceful degradation" that hides real failures. → "Failure Policy".
- **No interim implementations.** If the design picked a shape, build to that shape. "Phase 1 easy, phase 2 real" is a smell. → "YAGNI".
- **No backwards compatibility.** One client, always latest. No optional-for-backcompat parameters, no `@deprecated` shims, no missing-field fallbacks. → "No Backwards Compatibility".
- **Default to zero comments.** Comments are a symptom of unclear names. One line max when WHY is genuinely non-obvious. → "Comments".
- **Timeouts and intervals never inline.** Read from a config module, never hardcode in business logic. → "Timeouts, Intervals, and Retries".
- **Tests are deterministic, offline, fast.** No real-time waits, no real network, fake timers. → "Testing".
- **`Result<T, E>` for fallible operations.** No throwing from business logic: use discriminated unions. → "Failure Policy".
- **Write so anyone can read it.** Plain language is a rule, not a preference: ISO 24495-1 findable, understandable, actionable, consistent. Applies to code names, docs, and user-facing text alike. → "Write So Anyone Can Read It".
- **Names never leak a technology.** A name says what a thing is for, never what it is built on. `Db`, not `D1Database`. → "Names Never Leak a Technology".
- **Facts before fixes.** Reproduce it before you change code for it. A fix aimed at a described defect fixes the description. → "Facts Before Fixes".
- **Two failed attempts, look it up. Three, step back.** The second failure already told you your model of the problem is wrong. → "Troubleshooting Discipline".
- **Reviews are advisory; subsequent rounds taper.** Reviewer agents never block merge. On Round 2+ of the same PR, only flag NEW issues or fixes that are worse than the original: don't relitigate prior findings the author chose not to act on. → "Review Etiquette".

---

## Quick "What Not To Do" reminders

The full rules each link out from [`engineering/ENGINEERING_PRINCIPLES.md`](engineering/ENGINEERING_PRINCIPLES.md).

- Do not put business logic inside React components: UI is display-only.
- Do not use `any` to bypass type errors.
- Do not use `Math.random` in testable business logic; wrap it behind an injectable interface.
- Do not make network calls from React components; route through the service/agent layer.
- Do not commit secrets: `.env` and `.env.secrets` are gitignored.
- Do not throw errors for recoverable states: use `Result<T, E>` discriminated unions.
- Do not substitute fake/placeholder data when a critical-path operation fails.
- Do not inline timeout / interval / TTL / retry-count literals outside the config module.
- Do not add optional parameters or missing-field fallbacks "so old callers keep working": the compiler finds them all.
- Do not write multi-paragraph explanatory comments in source files.
- Do not expose developer/infrastructure config on end-user-facing UI.
- Do not use `slice` / `substring` to cap natural-language text in logs or API responses.
- Do not trust a tenant or account id that arrived in a path, body, or query. Identity comes from the session. See `engineering/SECURITY_PRINCIPLES.md` → "Identity Binding".
- Do not accept a loose write schema. The route's schema is a closed union over exactly the operations a client originates; everything else is server-derived. → "Client-Originated Mutations Are an Explicit Allowlist".
- Do not statically import a dev/preview harness that bypasses auth. It must be build-gated AND behind a dynamic `import()`, or the bundler ships the stub auth context to every user. → "Dev and Preview Harnesses".
- Do not push commits directly to the default branch. Every change opens a pull request, even one-line renames and "mechanical" cleanups. See `engineering/PR_WORKFLOW.md` → "Every change goes through a pull request" for the rule and the one narrow exception.

---

## Conventions (quick reference)

The full rules are in [`engineering/ENGINEERING_PRINCIPLES.md`](engineering/ENGINEERING_PRINCIPLES.md).

- **Naming** (enforced by ESLint): no dashes or underscores in filenames. Class files PascalCase matching the class (`GameClient.ts`). Utility/config files camelCase (`context.ts`). Suffixes are contracts: see "Naming Conventions" in ENGINEERING_PRINCIPLES.md.
- **One class per file**, named to match the filename. No free-standing exported functions.
- **Barrel exports (`index.ts`) per folder only when the folder is stable.** A barrel for a folder still in flux just adds an extra edit per change.
- **`Result<T, E>` for fallible operations**: no throwing from business logic.
- **Format**: Prettier defaults (2-space indent, single quotes, trailing commas). Never align values across lines with extra whitespace.
- **No em-dashes, no emoji/icons in prose.** Applies to new code, comments, commit messages, PR descriptions, and `engineering/`. Use a colon, parentheses, or a new sentence.

### Frontend conventions (apply when your project has a frontend)

- **CSS hierarchy**: a single `global.css` is the source of truth for tokens and shared utilities. Component `.module.css` files use `composes` from global, never duplicate. See "CSS" in ENGINEERING_PRINCIPLES.md.
- **Storage keys**: any new `localStorage` / `sessionStorage` key MUST be prefixed with your app namespace AND classified in a State Purge Contract doc.
- **Navigation**: UI components use a `NavigationService` / `useNavigation()` hook. Direct `react-router-dom` imports outside the navigation layer are a layering violation.
- **Auth**: the modern OAuth login flow only (the PKCE variant). Token storage: memory only (never `localStorage`). Refresh tokens: `HttpOnly` cookie set by the backend auth gateway. See `docs/SECURITY.md`.

---

## Agents

No PWA / generic variants: single file per agent. Frontend-specific rules live inline in each file, tagged `Architecture-Conditional`, and the installer strips them at install time for backend-only projects.

| Agent file | What it does |
|---|---|
| `alice_security.md` | Security review on every PR: routes, auth, secrets, cookies, log-leak hygiene; frontend categories when applicable (OAuth flow, service worker, CSP, IndexedDB) |
| `bob_engineering.md` | Engineering-principles review on every PR: god classes, naming contracts, fail-loud, over-abstraction; frontend categories when applicable (React component design, hooks, CSS modules) |
| `phil_testing.md` | Unit-testing review on every PR: test-first signal, intent-first naming, mocking discipline, failure-mode coverage |
| `gomez_cleancode.md` | Line-level clean-code review on every PR: names that communicate intent, density, idiom |
| `carl_ux.md` | UX review on every PR; installer omits the file entirely for backend-only projects |
| `jekyll_whitehat.md` | Whitehat critic of Alice / Bob / Phil findings, runs in the second review job |
| `hyde_blackhat.md` | Blackhat critic of Alice / Bob / Phil findings, runs in the second review job |
| `feature_agent.md` | Owns one unit of work at a time: drafts a design PR, waits for your `design-approved` label, then builds on the same branch |
| `scrum_master.md` | Closes shipped issues, auto-creates tracking issues, cleans up backlog |
| `story_groomer.md` | Decomposes decision docs into stories; grades issues `ready` (design it) or `build-ready` (build it) |
| `audit_groomer.md` | Turns weekly audit findings into pickup-ready issues for `feature_agent` |
| `hanging_refs.md` | Dead imports, unused exports, orphan routes, stale env vars, CSS dead classes |
| `naming_audit.md` | Suffix/contract mismatches against ENGINEERING_PRINCIPLES naming rules |
| `class_size_audit.md` | Flags classes over 1000 lines of executable code |
| `security_audit.md` | Auth middleware, schema validation, secret hygiene, logger leaks, cookie hygiene |
| `prompt_audit.md` | Optional, for projects that ship LLM prompts |
| `market_watch.md` | Weekly engineering-tool signals + tech ecosystem scan |
| `installer.md` | The wizard that deploys this kit into an adopter's target repo |

---

## Backlog and PR workflow

Both are bot-managed. Read these before opening an issue or PR:

- [`engineering/BACKLOG_WORKFLOW.md`](engineering/BACKLOG_WORKFLOW.md): how issues come into existence, the Definition of Ready, the `[story]` heading convention.
- [`engineering/PR_WORKFLOW.md`](engineering/PR_WORKFLOW.md): opening, greening CI, responding to review.

The agent fleet is documented in [`agents/`](agents/). The reference workflows are in [`workflows/`](workflows/), and [`workflows/README.md`](workflows/README.md) explains why they are shaped the way they are. Config for the AI coding tools an adopter's team uses lives in [`toolconfigs/`](toolconfigs/), and the GitLab, Bitbucket, and Azure DevOps pipelines live in [`ci/`](ci/) with [`ci/README.md`](ci/README.md) covering what ports and what does not.

---

## Adapting this repo

See [`ADAPTING.md`](ADAPTING.md) for the full checklist. The short version:

1. Fork or copy this repo.
2. Replace `REPO_OWNER/REPO_NAME` in every agent and workflow file with your GitHub repo slug.
3. Add the `CLAUDE_CODE_OAUTH_TOKEN` secret to your GitHub repo (Settings → Secrets).
4. Confirm the matrix in `workflows/pr-review.yml` matches the agents you want (start with `[bob_engineering, alice_security]`; add `gomez_cleancode` and `carl_ux` if your project benefits).
5. Add your own `docs/ARCHITECTURE.md` describing your stack.
6. Optionally extend `alice_security.md` / `bob_engineering.md` with project-specific rules by appending a "Project-specific extensions" section at the bottom.
