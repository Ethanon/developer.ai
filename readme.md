# developer.ai

A collection of Claude Code agents, engineering principles, automation workflows, and CI pipelines for TypeScript projects. Fork it, configure it for your repo, and get a production-quality AI-assisted development pipeline.

## What's included

**PR review pipeline** — Four agents review every PR automatically via GitHub Actions:

- `alice_security` — security review: routes, secrets, cookies, XSS, SSRF, auth bypass, logger leaks
- `bob_engineering` — engineering principles: naming, god classes, comments, over-abstraction, fail-loud
- `jekyll_critic` — whitehat critic: challenges Alice and Bob's findings
- `hyde_critic` — blackhat critic: attacks the code for bypasses and load failures

PWA variants (`alice_security_pwa`, `bob_engineering_pwa`) add React, CSS Modules, BFF, and OAuth/PKCE checks.

**Backlog automation** — Daily agents manage the issue lifecycle end-to-end:

- `story_groomer` — decomposes approved decision docs into pickup-ready issues (7-point Definition of Ready)
- `developer_agent` — picks up one `ready` issue per day, opens a PR, iterates on reviewer feedback
- `scrum_master` — closes shipped issues, creates tracking issues for merged PRs, cleans the backlog

**Weekly audits** — Read-only scanners that write Markdown reports to `.claude/reports/`:

- `hanging_refs` — dead imports, unused exports, orphan routes, stale env vars, CSS dead classes
- `naming_audit` — suffix/contract mismatches against the naming conventions in `ENGINEERING_PRINCIPLES.md`
- `class_size_audit` — classes over 300 lines or 8+ methods, with cohesion-test self-classification
- `security_audit` — schema validation gaps, hardcoded secrets, logger leaks, cookie hygiene, rate limiting
- `market_watch` — engineering-practice and tech-ecosystem signals with opinionated recommendations

**Skill** — `receiving-code-review` — guides Claude through evaluating and responding to PR feedback.

## Setup

See [docs/ADAPTING.md](docs/ADAPTING.md) for the full setup guide. The short version:

1. Fork or copy this repo.
2. Replace `REPO_OWNER/REPO_NAME` in every agent and workflow file with your GitHub slug.
3. Add `CLAUDE_CODE_OAUTH_TOKEN` to your repo secrets (Settings → Secrets and variables → Actions). Generate it with `claude setup-token`.
4. Choose `[bob_engineering, alice_security]` (generic) or `[bob_engineering_pwa, alice_security_pwa]` (React PWA) in `.github/workflows/pr-review.yml`.
5. Push to your default branch.

Alice, Bob, Jekyll, and Hyde will post on every PR automatically. The scheduled agents run via the cron jobs in `.github/workflows/scheduled-agents.yml`.

## Engineering principles

The agents enforce the rules in [docs/ENGINEERING_PRINCIPLES.md](docs/ENGINEERING_PRINCIPLES.md): naming conventions, failure policy, YAGNI, no backwards compatibility, no inline timeouts, deterministic tests. Read it before making changes — the agents will cite it in their reviews.

## License

MIT
