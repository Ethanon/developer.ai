# Calibrating the Agents to Your Project

The agents in this repo work out of the box; they ship with sensible defaults. They get noticeably more useful when you fill in a small set of project-specific facts. This document walks you through that process in priority order, so you spend your time on the highest-payoff calibration first.

You can stop after Step 2 and still get a real improvement on the first PR you open.

If you've already read `ADAPTING.md`, this doc picks up where it leaves off. ADAPTING covers the mechanical wire-up (copy files, set GitHub Secrets, point at your repo). CALIBRATE covers the project-context fill-in that makes the agents actually accurate.

---

## Don't enable the full fleet on day one

The installer happily wires up every agent in the kit at once. Don't let it. Adopt the agents in stages so each one earns your trust before the next one is allowed to act on your code. The arc:

**Stage 1: Observe-only.** Enable only the read-only agents: Alice, Bob, optionally Gomez and Carl. These post review comments on your PRs and nothing else. You read their findings, decide which are signal vs noise, and tune the templates accordingly. Nothing changes in your repo without your hand on the wheel.

**Stage 2: Add the critics.** Once Alice and Bob's output looks reliable, enable Jekyll and Hyde. They challenge the first-pass reviews and post short critique replies. Still no writes to your code or issue tracker; just more voices in the review thread.

**Stage 3: Add the audit bots.** Once you trust the per-PR review, turn on the weekly scanners (`hanging_refs`, `naming_audit`, `class_size_audit`, `security_audit`, optionally `prompt_audit`, `flaky_test_finder`, `market_watch`). They write reports to `.claude/reports/` and file nothing. You skim the reports Monday morning. (`flaky_test_finder` additionally needs your CI to emit JUnit XML as a workflow artifact; the agent's spec walks through the one-time config.)

**Stage 4: Add backlog grooming.** Once the audit reports look useful, enable `audit_groomer` (turns reports into issues), `story_groomer` (labels issues `ready`), and `scrum_master` (closes shipped issues). These write to GitHub Issues but never to your code.

**Stage 5: Add the developer agent.** This is the only agent that opens its own pull requests. Enable it last, after every upstream agent has earned its keep. If `developer_agent` opens a noisy PR in week one, the most common cause is that an upstream agent (Alice / Bob / story_groomer) was tuned poorly and the issue it picked up had bad acceptance criteria; that calibration debt rolls downhill.

Most projects burn out on AI adoption when an early agent makes a visible mistake on a write operation in week two. The staged approach prevents that: every write-capable agent comes online only after the read-only agents that feed it have proven trustworthy.

The installer's wizard has a question (#13-#16 in the Q&A) for which optional agents you want enabled today. Pick conservatively; you can always enable more later by adding the agent's file to `.claude/agents/` and the workflow matrix.

---

## What "calibration" means

Two layers of project context live in this repo:

1. **Templates** (`templates/`): three short documents you fill in and copy into your project's `docs/` folder. The agents read these as their source of truth. Most of the calibration happens here.

2. **Per-agent calibration blocks** (inside each `agents/*.md` file, near the top): a small set of slots that tune a specific agent to your codebase. Folder paths, middleware names, label values. These are filled directly inside the agent file once.

You **read** the agent files; you don't usually edit anything inside them except the calibration block.

---

## Step 1: Fill `PROJECT_CONTEXT.md` (highest payoff)

Open `templates/PROJECT_CONTEXT.md` and copy it to `docs/PROJECT_CONTEXT.md` in your project. Fill in every slot. The inline `<!-- Example: -->` comments show what a filled answer looks like; delete each comment after you've filled the slot.

The slots that move the dial the most:

- **What this project is.** One paragraph. Every agent reads this to ground its judgment.
- **How big it needs to be.** Tells Jekyll and Hyde whether a "this will fail at scale" critique is real or hypothetical.
- **How we host it.** Tells Jekyll not to recommend a managed service that your project has ruled out.
- **Our pieces (role-named services).** The list of containers (or services, or modules; whatever your project calls them) and the role each one plays. Alice and Bob use this to ground every architectural finding.
- **What we don't do.** Saves the agents from re-litigating decisions you've already made. The single highest-ROI section.

> Tip: the template itself ships with opinionated defaults pre-filled. Read it through once; the `## What this project is`, `## Who uses it`, and `## How we host it` paragraphs are placeholders you replace with your own. Other sections (the labels table, the bot identity table) only need editing if your project differs from the defaults.

After this step, every agent already has more context to work with. You could stop here and the kit would be useful.

---

## Step 2: Fill `SECURITY.md` (second-highest payoff)

Open `templates/SECURITY.md`, copy it to `docs/SECURITY.md` in your project. Fill it in.

This document calibrates Alice (the security review agent) and the security audit bot. A well-filled `SECURITY.md` cuts Alice's false-positive rate by roughly 80%. Specifically:

- **Trust boundaries.** What's inside the trusted set; everything else is untrusted.
- **How users sign in.** End-to-end flow. Alice flags any code that contradicts what's described here.
- **How requests are authorized.** The middleware name, what it attaches to the request context, what counts as a bypass.
- **How we store secrets.** What's never allowed (e.g. credentials in `.env` files committed to the repo).
- **Cookie policy.** Every cookie you set, with its flags and scope. Alice flags new cookies that violate this table.
- **Untrusted-input boundaries.** Where validation happens. A new route that bypasses validation is a finding.
- **What we log, and where.** The destination matters more than the content; this section names what's allowed to reach the browser console vs the server logs.
- **What we don't defend against (yet).** Risks you've accepted. Saves the agents from raising findings on these.

> Tip: the template ships pre-filled with a backend-auth-gateway pattern (the backend holds the session, the browser only has a cookie). If that matches your project, you mostly need to edit names and paths. If your auth shape is different, replace the affected paragraphs.

---

## Step 3: Fill `ARCHITECTURE.md`

Open `templates/ARCHITECTURE.md`, copy it to `docs/ARCHITECTURE.md`. Fill it in.

Bob (the engineering review agent) and the audit bots read this. The most-leveraged sections:

- **The big picture.** One paragraph anyone can skim and walk away understanding the shape.
- **Containers and their roles.** Same as `PROJECT_CONTEXT.md`'s services table, but with a "talks to" column so the agents understand which services communicate.
- **Layer responsibilities.** Who owns what kind of logic. Bob flags PRs that put business logic in the frontend, frontend logic in the backend, etc.
- **Decisions already made.** Index of your decision docs.

> Tip: the "Layer responsibilities" section is the one Bob leans on most. Write it carefully; vague layer rules produce vague layer findings.

---

## Step 4: Read one or two of the example decision docs

Skim `examples/decisions/`. Four worked examples are included:

- `004-auth-gateway.md`: a security/vendor decision.
- `028-client-layer.md`: an architectural layering decision.
- `037-fail-loud.md`: an engineering-philosophy decision.
- `071-scheduled-bots-on-github-actions.md`: an ops decision.

You don't have to write your own decision docs today. But knowing what one looks like means that the first time you want to record a decision, you have a model to copy. Use `templates/decisions/DECISION_TEMPLATE.md` for new ones.

---

## Step 5: Walk through each agent's calibration block

For each agent you're using, open its file in `agents/` and find the `## Project-specific calibration` section near the top. Fill in every slot.

The slots are short and specific:

- **Alice (`agents/pr-review/alice_security.md`):** routes folder, auth middleware name, where the tenant ID comes from, sanitizer name (if any), refresh-cookie path.
- **Bob (`agents/pr-review/bob_engineering.md`):** class-size thresholds, naming-conventions link, banned patterns specific to your codebase.
- **Gomez (`agents/pr-review/gomez_cleancode.md`):** source folder globs, naming collisions to watch for.
- **Carl (`agents/pr-review/carl_ux.md`):** frontend folder, global stylesheet path, target form factor, target session length.
- **Audit bots** (`agents/audits/*.md`): source folder globs, allowlist file paths, report folder.
- **Backlog bots** (`agents/backlog/*.md`): repo owner/name, default branch, label names.

You can fill these in over time as you start using each agent. Day-one priority: Alice and Bob (they fire on every PR).

---

## Step 6: Open a throwaway PR and watch the agents post

Open a small PR (a one-line README edit is fine) and watch the agents fire. You'll see:

- Alice and Bob post reviews. If they're either silent or noisy, your `PROJECT_CONTEXT.md` and `SECURITY.md` probably need more detail. Adjust and try again.
- Jekyll and Hyde post critique replies. If they're silent, that's fine: it means Alice and Bob's advice holds up.

A common iteration: Alice raises a finding that's correct in the abstract but doesn't apply to your stack. Find the relevant section in your `SECURITY.md` or `PROJECT_CONTEXT.md` "What we don't do" list, make it more explicit, and run the PR again. Each round of this tightens the agents to your codebase.

---

## Step 7: Schedule the weekly bots

If you copied `workflows/scheduled-agents.yml` (or split it into the per-bot files described in `ADAPTING.md`), check that the cron schedules make sense for your timezone. Defaults: weekly bots fire Monday 09:00 UTC, daily bots fire 08:00 UTC.

If you're in a heavily off-UTC timezone, edit the cron expressions so reports arrive when you're at your desk to read them.

---

## When to revisit calibration

Calibration drifts as your project evolves. Re-read your `PROJECT_CONTEXT.md` quarterly. Specifically check:

- The **scale target.** Did you cross from "a few hundred users" to "thousands"? Findings that were noise before may be real now.
- The **services table.** Did you add a new container or rename one? The agents won't know unless this table says so.
- The **"what we don't do" list.** Have any of those decisions softened? Time to update.

The agents are advisory; they always tell you what they think. Calibration is how you tell them what you think.
