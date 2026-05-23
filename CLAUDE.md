# developer.ai: Agent Guide

This file is the entry point. Real content lives in focused docs under `engineering/`. Read those for the rule you need.

If you are an agent: read this in full once, then read the linked doc(s) for the task you are about to do.

---

## What this is

**developer.ai** is a public collection of Claude Code agents, engineering principles, automation workflows, and CI pipelines for TypeScript projects. Fork it, configure it for your repo, and get a production-quality AI-assisted development pipeline out of the box.

The agents cover:
- Automated PR review (security, engineering principles, whithat/blackhat critique)
- Backlog automation (story grooming, issue lifecycle, developer-agent that self-assigns and ships issues)
- Weekly audits (dead code, naming violations, class size, security drift, market signals)
- Workflow utilities (receiving code review, metered conflict resolution)

Two tiers of agents exist: **generic** (any TypeScript project) and **_pwa** variants (React + CSS Modules + BFF + OAuth/PKCE stack).

See [ADAPTING.md](ADAPTING.md) for the one-time setup steps to point everything at your repo.

---

## Read first, by task

| Task | Required reading |
|---|---|
| Any code change | [`engineering/ENGINEERING_PRINCIPLES.md`](engineering/ENGINEERING_PRINCIPLES.md) |
| Architecture / data flow | `docs/ARCHITECTURE.md` (add your own) |
| AI agents (all roles, variants) | [`agents/`](agents/) |
| PR lifecycle | [`engineering/PR_WORKFLOW.md`](engineering/PR_WORKFLOW.md) |
| Backlog / issue lifecycle | [`engineering/BACKLOG_WORKFLOW.md`](engineering/BACKLOG_WORKFLOW.md) |
| Adapting this repo to your project | [`ADAPTING.md`](ADAPTING.md) |

---

## The Prime Directive

> **The preferred number of lines of code is zero.**

Every line is a liability. Write the minimum that correctly solves the problem. When in doubt, delete. Full anti-patterns and the design-review checklist live in [`engineering/ENGINEERING_PRINCIPLES.md`](engineering/ENGINEERING_PRINCIPLES.md) → "Default to Less" and "Design Review Checklist".

---

## Headline rules: the ones agents violate most often

These are pointers to the full rules in [`engineering/ENGINEERING_PRINCIPLES.md`](engineering/ENGINEERING_PRINCIPLES.md).

- **Fail loud, never fabricate.** Critical-path errors throw; client retries. No placeholder data, no synthetic ops, no "graceful degradation" that hides real failures. → "Failure Policy".
- **No interim implementations.** If the design picked a shape, build to that shape. "Phase 1 easy, phase 2 real" is a smell. → "YAGNI".
- **No backwards compatibility.** One client, always latest. No optional-for-backcompat parameters, no `@deprecated` shims, no missing-field fallbacks. → "No Backwards Compatibility".
- **Default to zero comments.** Comments are a symptom of unclear names. One line max when WHY is genuinely non-obvious. → "Comments".
- **Timeouts and intervals never inline.** Read from a config module, never hardcode in business logic. → "Timeouts, Intervals, and Retries".
- **Tests are deterministic, offline, fast.** No real-time waits, no real network, fake timers. → "Testing".
- **`Result<T, E>` for fallible operations.** No throwing from business logic — use discriminated unions. → "Failure Policy".

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
- Do not expose developer/infrastructure config on player-facing UI.
- Do not use `slice` / `substring` to cap natural-language text in logs or API responses.

---

## Conventions (quick reference)

The full rules are in [`engineering/ENGINEERING_PRINCIPLES.md`](engineering/ENGINEERING_PRINCIPLES.md).

- **Naming** (enforced by ESLint): no dashes or underscores in filenames. Class files PascalCase matching the class (`GameClient.ts`). Utility/config files camelCase (`context.ts`). Suffixes are contracts: see "Naming Conventions" in ENGINEERING_PRINCIPLES.md.
- **One class per file**, named to match the filename. No free-standing exported functions.
- **Barrel exports (`index.ts`) per folder only when the folder is stable.** A barrel for a folder still in flux just adds an extra edit per change.
- **`Result<T, E>` for fallible operations**: no throwing from business logic.
- **Format**: Prettier defaults (2-space indent, single quotes, trailing commas). Never align values across lines with extra whitespace.
- **No em-dashes, no emoji/icons in prose.** Applies to new code, comments, commit messages, PR descriptions, and `engineering/`. Use a colon, parentheses, or a new sentence.

### PWA / React conventions (applies when using `*_pwa` agent variants)

- **CSS hierarchy**: a single `global.css` is the source of truth for tokens and shared utilities. Component `.module.css` files use `composes` from global, never duplicate. See "CSS" in ENGINEERING_PRINCIPLES.md.
- **Storage keys**: any new `localStorage` / `sessionStorage` key MUST be prefixed with your app namespace AND classified in a State Purge Contract doc.
- **Navigation**: UI components use a `NavigationService` / `useNavigation()` hook. Direct `react-router-dom` imports outside the navigation layer are a layering violation.
- **Auth**: PKCE flow only (no implicit grant). Token storage: memory only (never `localStorage`). Refresh tokens: `HttpOnly` cookie set by the BFF. See `docs/SECURITY.md`.

---

## Agents

No PWA / generic variants — single file per agent. Frontend-specific rules live inline in each file, tagged `Architecture-Conditional`, and the installer strips them at install time for backend-only projects.

| Agent file | What it does |
|---|---|
| `alice_security.md` | Security review on every PR: routes, auth, secrets, cookies, log-leak hygiene; frontend categories when applicable (OAuth flow, service worker, CSP, IndexedDB) |
| `bob_engineering.md` | Engineering-principles review on every PR: god classes, naming contracts, fail-loud, over-abstraction; frontend categories when applicable (React component design, hooks, CSS modules) |
| `gomez_cleancode.md` | Line-level clean-code review on every PR: names that communicate intent, density, idiom |
| `carl_ux.md` | UX review on every PR; installer omits the file entirely for backend-only projects |
| `jekyll_whitehat.md` | Whitehat critic of Alice/Bob findings, runs in the second review job |
| `hyde_blackhat.md` | Blackhat critic of Alice/Bob findings, runs in the second review job |
| `developer_agent.md` | Self-assigns a `ready` issue, opens a PR, shepherds it through review |
| `scrum_master.md` | Closes shipped issues, auto-creates tracking issues, cleans up backlog |
| `story_groomer.md` | Decomposes decision docs into stories; evaluates issues against the Definition of Ready |
| `audit_groomer.md` | Turns weekly audit findings into pickup-ready issues for the developer agent |
| `hanging_refs.md` | Dead imports, unused exports, orphan routes, stale env vars, CSS dead classes |
| `naming_audit.md` | Suffix/contract mismatches against ENGINEERING_PRINCIPLES naming rules |
| `class_size_audit.md` | Flags classes >= 300 lines or >= 8 public methods |
| `security_audit.md` | Auth middleware, schema validation, secret hygiene, logger leaks, cookie hygiene |
| `prompt_audit.md` | Optional, for projects that ship LLM prompts |
| `market_watch.md` | Weekly engineering-tool signals + tech ecosystem scan |
| `installer.md` | The wizard that deploys this kit into an adopter's target repo |

---

## Backlog and PR workflow

Both are bot-managed. Read these before opening an issue or PR:

- [`engineering/BACKLOG_WORKFLOW.md`](engineering/BACKLOG_WORKFLOW.md): how issues come into existence, the Definition of Ready, the `[story]` heading convention.
- [`engineering/PR_WORKFLOW.md`](engineering/PR_WORKFLOW.md): opening, greening CI, responding to review.

The agent fleet is documented in [`agents/`](agents/) and the reference workflows are in [`workflows/`](workflows/).

---

## Adapting this repo

See [`ADAPTING.md`](ADAPTING.md) for the full checklist. The short version:

1. Fork or copy this repo.
2. Replace `REPO_OWNER/REPO_NAME` in every agent and workflow file with your GitHub repo slug.
3. Add the `CLAUDE_CODE_OAUTH_TOKEN` secret to your GitHub repo (Settings → Secrets).
4. Confirm the matrix in `workflows/pr-review.yml` matches the agents you want (start with `[bob_engineering, alice_security]`; add `gomez_cleancode` and `carl_ux` if your project benefits).
5. Add your own `docs/ARCHITECTURE.md` describing your stack.
6. Optionally extend `alice_security.md` / `bob_engineering.md` with project-specific rules by appending a "Project-specific extensions" section at the bottom.
