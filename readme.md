# developer.ai

A ready-to-fork collection of Claude Code agents, engineering principles, automation workflows, and CI pipelines for TypeScript projects.

Fork it, wire up a secret, and get a production-quality AI-assisted development pipeline on your next PR.

---

## What's included

### PR review pipeline (4 agents, runs on every PR)

| Agent | File | What it does |
|---|---|---|
| Alice | `agents/pr-review/alice_security.md` | Security review: routes, auth, secrets, cookies, XSS, SSRF, logger leaks |
| Bob | `agents/pr-review/bob_engineering.md` | Engineering review: god classes, naming contracts, fail-loud, over-abstraction |
| Jekyll | `agents/pr-review/jekyll_critic.md` | Whitehat critic: challenges Alice + Bob from a best-practices angle |
| Hyde | `agents/pr-review/hyde_critic.md` | Blackhat critic: attacks Alice + Bob's proposed fixes for real bypasses |

Two tiers: **generic** (`alice_security`, `bob_engineering`) for any TypeScript project, and **PWA variants** (`alice_security_pwa`, `bob_engineering_pwa`) for a React + BFF + OAuth/PKCE stack.

### Backlog automation (3 agents, run daily/on-demand)

| Agent | File | What it does |
|---|---|---|
| Developer | `agents/backlog/developer_agent.md` | Self-assigns a `ready` issue, opens a PR, shepherds it through review |
| Scrum Master | `agents/backlog/scrum_master.md` | Closes shipped issues, auto-creates tracking issues, cleans up backlog |
| Story Groomer | `agents/backlog/story_groomer.md` | Decomposes decision docs into stories; evaluates issues against Definition of Ready |

### Weekly audits (5 agents, run on a schedule)

| Agent | File | What it does |
|---|---|---|
| Hanging Refs | `agents/audits/hanging_refs.md` | Dead imports, unused exports, orphan routes, stale env vars |
| Naming Audit | `agents/audits/naming_audit.md` | Suffix/contract mismatches against the naming rules |
| Class Size Audit | `agents/audits/class_size_audit.md` | Flags classes >= 300 lines or >= 8 public methods |
| Security Audit | `agents/audits/security_audit.md` | Auth routes, schema validation, secrets hygiene, logger leaks, cookie hygiene |
| Market Watch | `agents/audits/market_watch.md` | Weekly engineering-tool signals and tech ecosystem scan |

### Skills (copy to `.claude/skills/` in your project)

Two sets: **TypeScript** (`skills/typescript/`) and **Python** (`skills/python/`). Each set covers the same four skills with language-appropriate examples.

**TypeScript skills:**

| Skill | Path | When to use |
|---|---|---|
| Receiving code review | `skills/typescript/receiving-code-review/SKILL.md` | When Alice/Bob/Jekyll/Hyde review lands on your PR |
| Test-driven development | `skills/typescript/test-driven-development/SKILL.md` | When implementing any feature or bugfix |
| Code refactoring | `skills/typescript/code-refactoring/SKILL.md` | When cleaning up legacy code or reducing complexity |
| Visual smoke testing | `skills/typescript/visual-smoke/SKILL.md` | When a fix touches client-side UI or styles |

**Python skills:**

| Skill | Path | When to use |
|---|---|---|
| Receiving code review | `skills/python/receiving-code-review/SKILL.md` | When Alice/Bob/Jekyll/Hyde review lands on your PR |
| Test-driven development | `skills/python/test-driven-development/SKILL.md` | When implementing any feature or bugfix (pytest) |
| Code refactoring | `skills/python/code-refactoring/SKILL.md` | When cleaning up legacy code or reducing complexity |
| Visual smoke testing | `skills/python/visual-smoke/SKILL.md` | When a fix touches templates, static files, or a bundled SPA |

### Reference workflows (copy to `.github/workflows/` in your project)

| File | What it does |
|---|---|
| `workflows/pr-review.yml` | Triggers Alice + Bob on every PR, then Jekyll + Hyde after |
| `workflows/scheduled-agents.yml` | Cron schedules for audit and backlog agents |

### Engineering docs (copy to `engineering/` in your project)

- `engineering/ENGINEERING_PRINCIPLES.md` — KISS, SOLID, DRY, YAGNI, naming, failure policy, CSS hierarchy
- `engineering/PR_WORKFLOW.md` — opening PRs, greening CI, responding to review
- `engineering/BACKLOG_WORKFLOW.md` — issue lifecycle, Definition of Ready, story format

---

## Quick start

**To get the full pipeline on your TypeScript project:**

1. Copy `agents/` into `.claude/agents/` in your target repo.
2. Copy `skills/typescript/` (or `skills/python/`) into `.claude/skills/` in your target repo.
3. Copy `engineering/` into your target repo.
4. Copy `workflows/pr-review.yml` into `.github/workflows/pr-review.yml`.
5. Run `claude setup-token` and add the token as `CLAUDE_CODE_OAUTH_TOKEN` in GitHub Secrets.
6. Replace `REPO_OWNER/REPO_NAME` in the workflow and backlog agent files.
7. Add `docs/ARCHITECTURE.md` and `docs/SECURITY.md` describing your system.
8. Push.

Alice and Bob post reviews on your next PR. Jekyll and Hyde follow.

**Full setup guide:** [ADAPTING.md](ADAPTING.md)

---

## Minimal viable setup (PR review only)

```bash
# In your target repo:
mkdir -p .claude/agents .github/workflows

# Copy the four PR-review agents
cp /path/to/developer.ai/agents/pr-review/*.md .claude/agents/

# Copy skills for your language (pick one)
cp -r /path/to/developer.ai/skills/typescript .claude/skills/   # TypeScript project
cp -r /path/to/developer.ai/skills/python .claude/skills/       # Python project

# Copy the workflow
cp /path/to/developer.ai/workflows/pr-review.yml .github/workflows/pr-review.yml
```

Then add the `CLAUDE_CODE_OAUTH_TOKEN` secret and update the branch/repo references in the workflow.

---

## Adopting the engineering principles

The principles in `engineering/ENGINEERING_PRINCIPLES.md` work standalone. Copy the file into your repo, reference it in your CLAUDE.md, and the PR review agents will find it automatically.

The condensed version of the rules is in `CLAUDE.md`.

---

## License

MIT. Fork, extend, ship.
