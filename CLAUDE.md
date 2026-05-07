# Evertales: Agent Guide

This file is the entry point. It is intentionally short. Real content lives in focused docs under `docs/design/`. Read those for the rule you need; do not memorize this file.

If you are an agent: read this in full once, then read the linked doc(s) for the task you are about to do. Do not skip the linked docs.

---

## What this is

Evertales is a TypeScript PWA that blends deterministic D&D 5e SRD 5.2.1 rules with AI-driven narrative. See [README.md](README.md) for tech stack, directory structure, and how to run the project.

---

## Read first, by task

| Task | Required reading |
|---|---|
| Any code change | [`docs/design/ENGINEERING_PRINCIPLES.md`](docs/design/ENGINEERING_PRINCIPLES.md) |
| Anything that resolves a mechanic, voices a character, advances the story, or reads/writes memory | [`docs/design/GAME_ENGINEERING_PRINCIPLES.md`](docs/design/GAME_ENGINEERING_PRINCIPLES.md) |
| Architecture / data flow | [`docs/design/ARCHITECTURE.md`](docs/design/ARCHITECTURE.md) |
| How the harness orchestrates the game-agent fleet (action loop, subloops, jobs) | [`docs/design/GAME_HARNESS.md`](docs/design/GAME_HARNESS.md) |
| AI agents (DM, Story, Mechanics, Director, etc.) | [`docs/design/AI_GAME_AGENTS.md`](docs/design/AI_GAME_AGENTS.md) |
| Editing or adding any LLM prompt | [`docs/design/PROMPT_RULES.md`](docs/design/PROMPT_RULES.md) (construction rules + builder API + audit checklist) and [`docs/design/prompt-flows.md`](docs/design/prompt-flows.md) (catalog) |
| Memory / context strategy | [`docs/design/MEMORY_STRATEGY.md`](docs/design/MEMORY_STRATEGY.md) |
| Game mechanics (combat, skills, leveling) | [`docs/design/GAME_DESIGN.md`](docs/design/GAME_DESIGN.md), [`docs/References/SRD_CC_v5.2.1.pdf`](docs/References/SRD_CC_v5.2.1.pdf) |
| Security / auth / tenancy | [`docs/design/SECURITY.md`](docs/design/SECURITY.md) |
| Backlog / issue lifecycle | [`docs/design/BACKLOG_WORKFLOW.md`](docs/design/BACKLOG_WORKFLOW.md) |
| Pull request lifecycle | [`docs/design/PR_WORKFLOW.md`](docs/design/PR_WORKFLOW.md) |
| Speculative concerns we have NOT built | [`docs/design/FUTURE_CONSIDERATIONS.md`](docs/design/FUTURE_CONSIDERATIONS.md) |
| Specific architectural decisions | [`docs/design/decisions/`](docs/design/decisions/) (numbered 001+) |
| Who Evertales is for | [`docs/design/USER_PERSONAS.md`](docs/design/USER_PERSONAS.md): check feature proposals against this before designing |

---

## The Prime Directive

> **The preferred number of lines of code is zero.**

Every line is a liability. Write the minimum that correctly solves the problem. When in doubt, delete. Full anti-patterns and the design-review checklist live in [`ENGINEERING_PRINCIPLES.md`](docs/design/ENGINEERING_PRINCIPLES.md) → "Default to Less" and "Design Review Checklist".

---

## Headline rules: the ones agents violate most often

These are pointers to the full rules in [`ENGINEERING_PRINCIPLES.md`](docs/design/ENGINEERING_PRINCIPLES.md). One line each so you remember the constraint exists; click through for the actual rule before writing code.

- **AI does story. Code does math.** Pure functions resolve mechanics; agents narrate. The full deterministic-vs-AI taxonomy, the SRD-fidelity rule, the memory-first rule, and the story-integrity invariants live in [`GAME_ENGINEERING_PRINCIPLES.md`](docs/design/GAME_ENGINEERING_PRINCIPLES.md).
- **Fail loud, never fabricate.** Critical-path errors throw; client retries. No placeholder narrative, no synthetic ops, no "graceful degradation." → "Failure Policy" + [decision 037](docs/design/decisions/037-fail-loud-on-critical-agent-paths.md).
- **No interim implementations.** If the design picked a shape, build to that shape. "Phase 1 easy, phase 2 real" is a smell. → "YAGNI" + [decisions/](docs/design/decisions/) for the relevant doc.
- **Thou shalt not `.slice` prose.** No string `.slice` / `.substring` / sentence/word/char caps on natural-language text. Enforced by `evertales-local/no-string-slice` and [decision 036](docs/design/decisions/036-no-narrative-or-log-truncation.md).
- **Addresses are paths, not parameter salads.** One `path: string` parameter, parsed by `StoryPath.ids(...)`. Never add a new scattered `tenantId` / `worldId` / `sceneId` parameter. → "StoryPath" + [decision 034](docs/design/decisions/034-world-context-and-story-path.md).
- **No backwards compatibility.** One client, always latest. No optional-for-backcompat parameters, no `@deprecated` shims, no missing-field fallbacks. → "No Backwards Compatibility".
- **Default to zero comments.** Comments are a symptom of unclear names. One line max when WHY is genuinely non-obvious. → "Comments".
- **Timeouts and intervals never inline.** Read from `config.timeouts.*` (server) or `Settings.ts` (client). → "Timeouts, Intervals, and Retries".
- **Tests are deterministic, offline, fast.** No real-time waits, no real network, fake timers. → "Testing".

---

## Quick "What Not To Do" reminders

The full rules each link out from [`ENGINEERING_PRINCIPLES.md`](docs/design/ENGINEERING_PRINCIPLES.md). This list exists because some of these mistakes are reflexive.

- Do not put game logic inside React components: UI is display-only.
- Do not use `any` to bypass type errors.
- Do not let AI agents decide dice outcomes; route through `DiceRoller`.
- Do not use `Math.random` outside pure UI presentation; route through `Random`.
- Do not invent lore that contradicts established player-memory; check memory first.
- Do not repeat story hooks already in `used-hook` memory; query before selecting.
- Do not add XP-based leveling.
- Do not make network calls from React components; route through the agent/service layer.
- Do not commit secrets: `.env.secrets` is gitignored, four bootstrap secrets only.
- Do not throw errors for recoverable game states: use `Result<T, E>` discriminated unions.
- Do not expose developer/infrastructure config on player-facing UI; the Settings screen is for player preferences only.
- Do not substitute fake/placeholder data when a critical-path operation fails: see "Fail loud" above.
- Do not truncate natural-language text with `slice` / `substring` / sentence / word / char caps. Applies to prompts, persisted records, AND log lines. Inline disable with reason if a non-prose `.slice` is genuinely needed; see [decision 036](docs/design/decisions/036-no-narrative-or-log-truncation.md).
- Do not inline timeout / interval / TTL / retry-count literals outside `config.ts` (server) or `Settings.ts` (client). Read from the config block.
- Do not add optional parameters or missing-field fallbacks "so old callers keep working": there are no old callers; the compiler finds them all.
- Do not write multi-paragraph explanatory comments in source files. One-line WHY when genuinely non-obvious; otherwise zero.
- Do not add scattered tenant/world/scene/actor ID parameters: extend the path string.
- Do not introduce new env files: see "Environment" below.

---

## Conventions (quick reference)

The full rules are in [`ENGINEERING_PRINCIPLES.md`](docs/design/ENGINEERING_PRINCIPLES.md). This is a memory aid.

- **Naming** (enforced by ESLint): no dashes or underscores in filenames. Class files PascalCase matching the class (`GameClient.ts`). Utility/config files camelCase (`context.ts`). Suffixes are contracts: see "Naming Conventions" in ENGINEERING_PRINCIPLES.md.
- **One class per file**, named to match the filename. No free-standing exported functions.
- **Generators are static utility classes**: `DiceRoller.roll()`, `NameGenerator.generate()`. No instantiation.
- **Barrel exports (`index.ts`) per folder only when the folder is stable.** A barrel for a folder still in flux just adds an extra edit per change. Wait until the shape settles.
- **`Result<T, E>` for fallible operations**: no throwing from game logic.
- **All combat state lives in `CombatEncounter`**: never persisted to agent memory mid-fight. The encounter object is the source of truth; memory writes happen at encounter end.
- **Format**: Prettier defaults (2-space indent, single quotes, trailing commas). Never align values across lines with extra whitespace.
- **No em-dashes, no emoji/icons in prose.** Applies to new code, comments, commit messages, PR descriptions, and `docs/`. Use a colon, parentheses, or a new sentence.
- **CSS hierarchy**: `client/src/styles/global.css` is the single source of truth for tokens and shared utilities. Component `.module.css` files use `composes` from global, never duplicate. See "CSS" in ENGINEERING_PRINCIPLES.md.
- **Storage keys**: any new client-side `localStorage` / `sessionStorage` key MUST be prefixed `evertales:` AND classified in [decision 060](docs/design/decisions/060-client-navigation-and-session-lifecycle.md) State Purge Contract.
- **Navigation**: UI components use `NavigationService` / `useNavigation()` from `client/src/System/Navigation/`. Direct `react-router-dom` imports outside that folder are a layering violation.
- **WorldRecord mutations** go through `gameMechanics/src/components/WorldOps.ts`: never spread-and-replace. See [decision 002](docs/design/decisions/002-worldops-delta-operations.md) and [`GAME_ENGINEERING_PRINCIPLES.md`](docs/design/GAME_ENGINEERING_PRINCIPLES.md) → "Delta Operations".
- **All AI calls** go through role-typed clients (`StoryClient`, `UtilityClient`, `EmbeddingClient`, `MediaClient`) on the `Clients` container. Agents never import backend SDKs directly. See [decision 028](docs/design/decisions/028-adapter-client-pattern.md).
- **All timing/measurement** goes through `MetricsReporter` (`clients.metrics`). Never roll your own `Date.now()` + subtract. See [decision 031](docs/design/decisions/031-metrics-service.md).

### UI patterns: consistency rules for every screen

- **Home access**: every non-landing screen has a way back to landing. Wizards use a close button in the parent frame; all other screens use a top-left "Back" or "Menu" text link.
- **State persistence**: the app always saves state before navigating away: the user can leave any screen and resume later via Continue (last session) or Campaigns (pick one).
- **Settings access**: a gear icon or "Settings" link should be reachable from any primary screen (landing, campaign landing, in-game): not just the landing page.
- **Standard layout**: non-wizard screens use `.sub-screen` for max-width + padding; header at top, content scrollable, nav at bottom if needed.
- **Shared components**: use `.btn` / `.btn-card` / `.btn-nested` from `global.css` for all interactive elements. Use `.choice-label` for section headers above groups. Use `.card-grid` for lists of selectable items. Never invent new button styles per screen.

---

## Backlog and PR workflow

Both are bot-managed. Read these before opening an issue or a PR:

- [`docs/design/BACKLOG_WORKFLOW.md`](docs/design/BACKLOG_WORKFLOW.md): how issues come into existence, the Definition of Ready, the `[story]` heading convention, what humans must NOT do.
- [`docs/design/PR_WORKFLOW.md`](docs/design/PR_WORKFLOW.md): opening, greening CI, responding to review.

The fleet of agents (story-groomer, scrum-master, audit-groomer, audit bots, developer-agent, Alice/Bob/Jekyll/Hyde reviewers, market-watch) is documented in [`.claude/agents/`](.claude/agents/) and orchestrated by GitHub Actions in [`.github/workflows/`](.github/workflows/) per [decision 071](docs/design/decisions/071-scheduled-agents-via-github-actions.md).

---

## Environment

Three categories of config; each has one canonical home. **Do not introduce new env files.** README.md covers the first-time-setup flow; this is the at-a-glance reference for "where do I put a new value?"

- **`.env.secrets`** (gitignored, four bootstrap secrets): `TUNNEL_TOKEN`, `HUGGINGFACE_TOKEN`, `DATASTORE_SQL_ROOT_PASSWORD`, `AUTH_ADMIN_PASSWORD`. Copy from `.env.secrets.example` on each developer machine. Production reads the same four values from GitHub Actions Secrets.
- **`docker-compose.dev.yml` / `docker-compose.prod.yml`**: public-origin URLs (`KC_HOSTNAME`, `AUTH_PUBLIC_BASE_URL`, `AUTH_ISSUER_URL`, `CORS_ORIGINS`). Different values per env; mismatch silently breaks Keycloak's `id_token_hint`. Not in env files.
- **`home.bat` / `laptop.bat`**: per-rig knobs `set` inline. Model names default in the base compose (`gemma4` / `qwen2.5:7b`); override `STORY_MODEL_NAME` / `UTILITY_MODEL_NAME` only if the rig needs it.

Where each kind of value lives:

```
# Bootstrap secrets -> .env.secrets (gitignored) and GH Actions Secrets:
TUNNEL_TOKEN, HUGGINGFACE_TOKEN, DATASTORE_SQL_ROOT_PASSWORD, AUTH_ADMIN_PASSWORD

# Public-origin URLs -> hardcoded in docker-compose.dev.yml / docker-compose.prod.yml
# (different values per env; mismatch silently breaks Keycloak id_token_hint)
KC_HOSTNAME, AUTH_PUBLIC_BASE_URL, AUTH_ISSUER_URL, CORS_ORIGINS

# Model selection -> :- defaults in docker-compose.yml
STORY_MODEL_NAME=gemma4, UTILITY_MODEL_NAME=qwen2.5:7b

# Per-rig knobs -> set inline in home.bat / laptop.bat
DATA_DIR, VITE_PROXY_TARGET, COMPOSE_PROFILES, NODE_OPTIONS, UTILITY_OLLAMA_NUM_GPU
```

Bootstrap secret? Add a slot to `.env.secrets.example`. Per-env URL? Hardcode in the matching compose overlay. Per-rig knob? `set` in the launch script. Anything else is over-architecting.
