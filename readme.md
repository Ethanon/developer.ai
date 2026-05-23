# developer.ai

A ready-to-fork collection of AI agents, engineering principles, and workflow automation for projects of any size. Fork it, fill in a small set of project-specific facts, and get a production-quality AI-assisted development pipeline on your next pull request.

---

## What's included

### PR review pipeline (up to 6 agents, runs on every PR)

| Agent | File | What it does |
|---|---|---|
| Alice | `agents/pr-review/alice_security.md` | Security review: routes, auth, secrets, cookies, XSS, SSRF, log-leak hygiene |
| Bob | `agents/pr-review/bob_engineering.md` | Engineering review: god classes, naming contracts, fail-loud, over-abstraction |
| Gomez | `agents/pr-review/gomez_cleancode.md` | Line-level clean-code review: names that communicate intent, density, idiom |
| Carl | `agents/pr-review/carl_ux_pwa.md` | UX review: mobile fit, copy quality, latency masking, studio-quality polish |
| Jekyll | `agents/pr-review/jekyll_critic.md` | Whitehat critic: challenges Alice + Bob + Gomez from a best-practices angle |
| Hyde | `agents/pr-review/hyde_critic.md` | Blackhat critic: attacks the others' proposed fixes for real bypasses |

Two tiers of Alice and Bob: **generic** (`alice_security`, `bob_engineering`) for any project, and **PWA variants** (`alice_security_pwa`, `bob_engineering_pwa`) for a React frontend + backend-auth-gateway stack. Gomez and Carl are PWA-flavored but mostly portable.

### Backlog automation (4 agents, run daily/weekly/on-demand)

| Agent | File | What it does |
|---|---|---|
| Developer | `agents/backlog/developer_agent.md` | Self-assigns a `ready` issue, opens a PR, shepherds it through review |
| Scrum Master | `agents/backlog/scrum_master.md` | Closes shipped issues, auto-creates tracking issues, cleans up backlog |
| Story Groomer | `agents/backlog/story_groomer.md` | Decomposes decision docs into stories; evaluates issues against Definition of Ready |
| Audit Groomer | `agents/backlog/audit_groomer.md` | Turns weekly audit findings into pickup-ready issues for the developer agent |

### Weekly audits (6 agents, run on a schedule)

| Agent | File | What it does |
|---|---|---|
| Hanging Refs | `agents/audits/hanging_refs.md` | Dead imports, unused exports, orphan routes, stale env vars |
| Naming Audit | `agents/audits/naming_audit.md` | Suffix/contract mismatches against your naming rules |
| Class Size Audit | `agents/audits/class_size_audit.md` | Flags classes >= 300 lines or >= 8 public methods |
| Security Audit | `agents/audits/security_audit.md` | Auth routes, schema validation, secrets hygiene, log-leak hygiene, cookie hygiene |
| Prompt Audit | `agents/audits/prompt_audit.md` | (Optional) Audits LLM prompt templates against your project's prompt rules |
| Market Watch | `agents/audits/market_watch.md` | Weekly engineering-tool signals and ecosystem scan |

### Skills (copy to `.claude/skills/` in your project)

Two language sets: **TypeScript** (`skills/typescript/`) and **Python** (`skills/python/`). Each set covers the same baseline skills with language-appropriate examples.

**TypeScript skills:**

| Skill | Path | When to use |
|---|---|---|
| Receiving code review | `skills/typescript/receiving-code-review/SKILL.md` | When the agents post their review on your PR |
| Test-driven development | `skills/typescript/test-driven-development/SKILL.md` | When implementing any feature or bugfix |
| Code refactoring | `skills/typescript/code-refactoring/SKILL.md` | When cleaning up legacy code or reducing complexity |
| Visual smoke testing | `skills/typescript/visual-smoke/SKILL.md` | When a fix touches client-side UI or styles |
| DevHarness for UI iteration | `skills/typescript/dev-harness-for-ui-iteration/SKILL.md` | When tuning UI polish without booting the full backend |

**Python skills:**

| Skill | Path | When to use |
|---|---|---|
| Receiving code review | `skills/python/receiving-code-review/SKILL.md` | Same as TypeScript |
| Test-driven development | `skills/python/test-driven-development/SKILL.md` | When implementing features (pytest) |
| Code refactoring | `skills/python/code-refactoring/SKILL.md` | Cleanup, complexity reduction |
| Visual smoke testing | `skills/python/visual-smoke/SKILL.md` | Templates, static files, or a bundled frontend |

### Templates (copy to `docs/` in your project, then fill in)

| File | What it calibrates |
|---|---|
| `templates/PROJECT_CONTEXT.md` | What this project is, who uses it, scale, hosting, role-named services. Every agent reads this. |
| `templates/ARCHITECTURE.md` | The system shape and layer responsibilities. Bob and the audits read this. |
| `templates/SECURITY.md` | Trust boundaries, sign-in flow, authorization, secrets, cookies. Alice and security-audit read this. |
| `templates/decisions/DECISION_TEMPLATE.md` | The shape of a good decision doc, with inline guidance comments. |

### Examples (read for shape, don't copy verbatim)

| File | Shows |
|---|---|
| `examples/PROJECT_CONTEXT.md` | A filled-in version of the project context template |
| `examples/ARCHITECTURE.md` | A filled-in architecture doc for a hypothetical team-collaboration app |
| `examples/SECURITY.md` | A filled-in security model using a backend-auth-gateway pattern |
| `examples/decisions/004-auth-gateway.md` | A security/vendor decision worked example |
| `examples/decisions/028-client-layer.md` | An architectural layering decision worked example |
| `examples/decisions/037-fail-loud.md` | An engineering-philosophy decision worked example |
| `examples/decisions/071-scheduled-bots-on-github-actions.md` | An ops/automation decision worked example |

### Reference workflows (copy to `.github/workflows/` in your project)

| File | What it does |
|---|---|
| `workflows/pr-review.yml` | Triggers Alice and Bob on every PR, then Jekyll and Hyde after |
| `workflows/scheduled-agents.yml` | Cron schedules for the audit and backlog agents |

### Engineering docs (copy to `engineering/` in your project)

- `engineering/ENGINEERING_PRINCIPLES.md` — KISS, SOLID, DRY, YAGNI, naming conventions, failure policy, frontend layering
- `engineering/PR_WORKFLOW.md` — opening PRs, greening CI, responding to review
- `engineering/BACKLOG_WORKFLOW.md` — issue lifecycle, Definition of Ready, story format

---

## Setup overview

Setting this up has two parts:

1. **Mechanical wire-up** (15-30 minutes) — see [ADAPTING.md](ADAPTING.md). Copy files into your repo, replace `REPO_OWNER/REPO_NAME` placeholders, add a GitHub Actions secret.
2. **Project calibration** (1-2 hours) — see [CALIBRATE.md](CALIBRATE.md). Fill in the three templates and the per-agent calibration blocks. This is what makes the agents accurate.

Most adopters do part 1 in a single sitting, then part 2 spread across a few days as they get comfortable with what each agent does.

### Quick start

```bash
# In your target repo:
mkdir -p .claude/agents .claude/skills docs/decisions .github/workflows

# Copy the agents
cp -r /path/to/developer.ai/agents/* .claude/agents/

# Copy the skills for your language (pick one)
cp -r /path/to/developer.ai/skills/typescript/* .claude/skills/

# Copy the templates and start filling them in
cp /path/to/developer.ai/templates/PROJECT_CONTEXT.md docs/
cp /path/to/developer.ai/templates/SECURITY.md docs/
cp /path/to/developer.ai/templates/ARCHITECTURE.md docs/
cp /path/to/developer.ai/templates/decisions/DECISION_TEMPLATE.md docs/decisions/

# Copy the workflows
cp /path/to/developer.ai/workflows/*.yml .github/workflows/
```

Then add the `CLAUDE_CODE_OAUTH_TOKEN` GitHub Secret and update the repo references in the workflows. Full setup checklist in [ADAPTING.md](ADAPTING.md).

---

## Writing style

These docs and templates avoid jargon where plain English will do — see [STYLE.md](STYLE.md) for the rules. Adopters of this kit are not all senior engineers; the templates are written so a solo developer, a student, or a technical founder can fill them in without having to Google a dozen acronyms.

If you contribute back to this repo, please follow the same rules.

---

## License

MIT. Fork, extend, ship.
