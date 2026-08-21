# Adapting developer.ai to Your Project

This document walks through the **mechanical setup** required to point the agent fleet at your GitHub repo. It's the "copy these files, set these secrets, replace these placeholders" guide.

Once the agents are wired up and firing, see [CALIBRATE.md](CALIBRATE.md) to make them accurate for your specific project (the part that fills in templates and per-agent calibration slots).

---

## Step 1: Fork or copy this repo

Fork `Ethanon/developer.ai` on GitHub, or copy the directory structure into your own repo. The agents work from the repo they're checked out in, so the files must live in your repo (not as a submodule or remote reference).

---

## Step 2: Set your repo identity

Every agent that interacts with GitHub has a hardcoded `REPO_OWNER/REPO_NAME` placeholder. Replace these throughout the agent files before enabling any automation.

**Find all occurrences:**

```bash
grep -r "REPO_OWNER/REPO_NAME" agents/ workflows/
```

**Replace with your GitHub repo slug** (e.g. `myorg/myproject`):

Files to update:
- `agents/backlog/scrum_master.md`: repo identity section
- `agents/backlog/developer_agent.md`: repo identity section
- `agents/backlog/story_groomer.md`: repo identity section
- `agents/backlog/audit_groomer.md`: repo identity section
- `workflows/pr-review.yml`: fork guard condition
- `workflows/scheduled-agents.yml`: fork guard condition (if used)

Also update the default branch name if yours is not `master` (e.g. change to `main`):
- `agents/backlog/scrum_master.md`
- `agents/backlog/developer_agent.md`
- `agents/backlog/story_groomer.md`
- `agents/backlog/audit_groomer.md`
- `workflows/pr-review.yml`
- `workflows/scheduled-agents.yml`

---

## Step 3: Add the GitHub Actions secret

The PR review workflow needs a Claude Code OAuth token to run the agents.

1. Run `claude setup-token` locally to generate an OAuth token.
2. In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**
3. Name: `CLAUDE_CODE_OAUTH_TOKEN`
4. Value: the token from step 1.

The workflow checks for this secret and prints an error if missing.

---

## Step 4: Choose which review agents to include

Seven PR-review agents ship in this kit. There are no generic-vs-PWA variants any more. Frontend-specific rules live inline in each file, tagged Architecture-Conditional, and either survive or get stripped at install time based on whether your project has a frontend.

### Core review agents (always on)

- **Alice** (`alice_security.md`): security review.
- **Bob** (`bob_engineering.md`): engineering-principles review.

```yaml
matrix:
  agent: [bob_engineering, alice_security]
```

### Optional extra reviewers

- **Gomez** (`gomez_cleancode.md`): line-level density and naming-for-intent. Useful for any codebase; especially valuable on AI-generated code that passes the suffix contract but tells a human reader nothing.
- **Carl** (`carl_ux.md`): UX review. Only useful for projects with a user interface; the installer omits Carl entirely for backend-only projects.

Add either or both to the workflow matrix:

```yaml
matrix:
  agent: [bob_engineering, alice_security, gomez_cleancode, carl_ux]
```

### Critique agents (Jekyll, Hyde)

`jekyll_whitehat.md` and `hyde_blackhat.md` critique whatever the first-pass reviewers post. They run in the second job, after the review job finishes.

---

## Step 5: Add your own ARCHITECTURE.md

The review agents read `docs/ARCHITECTURE.md` as the source of truth for system structure, layer responsibilities, and data flow. Without it, they fall back to generic patterns.

Create `docs/ARCHITECTURE.md` describing:
- System components and their boundaries
- Data flow (what talks to what)
- Layer responsibilities (which layer owns what logic)
- Key decisions already made (auth pattern, persistence, etc.)

This is the highest-ROI setup step. Agents that know your architecture post far fewer false positives.

---

## Step 6: Add your own SECURITY.md (for security-audit and alice)

`alice_security.md` and `security_audit.md` read `docs/SECURITY.md` as the source of truth for your security model. Without it, Alice falls back to generic OWASP guidance.

Create `docs/SECURITY.md` covering:
- Trust boundaries and threat actors
- Auth and session model
- Tenant isolation (if multi-tenant)
- Secret management approach
- Cookie policy
- Any security decisions already made

---

## Step 7: Update the CI workflow if needed

`workflows/pr-review.yml` defaults to:
- `runs-on: ubuntu-latest`: change to `self-hosted` if you have your own runners
- `branches: [master]`: change to match your default branch
- Fork guard: the existing guard skips forks. Keep this; fork PRs can't safely access repo secrets.

---

## Step 8: Configure allowlists (optional)

Several agents read allowlist files to skip known-good patterns:

| File | Agent | Purpose |
|---|---|---|
| `.claude/hanging-refs-allowlist.md` | `hanging_refs` | Dynamic-dispatch patterns that look like dead refs |
| `.claude/naming-audit-allowlist.md` | `naming_audit` | Accepted non-standard names (domain nouns, React components) |
| `.claude/security-audit-allowlist.md` | `security_audit` | Findings the reviewer has accepted (by line key) |
| `.claude/prompt-audit-allowlist.md` | `prompt_audit` | Prompt-rule carve-outs |
| `.claude/scrum-master-allowlist.md` | `scrum_master` | Issues/PRs that should never be auto-closed or auto-tracked |
| `.claude/developer-agent-allowlist.md` | `developer_agent` | Issues/paths the agent should never touch |
| `.claude/story-groomer-allowlist.md` | `story_groomer` | Issues or doc sections that should never get the `ready` label |
| `.claude/audit-groomer-allowlist.md` | `audit_groomer` | Audit findings that should not be converted into issues |

These files are created by agents when needed. You can also create them manually before the first run. Format is described in each agent's spec.

---

## Step 9: Calibrate the agents to your project

This is the big payoff step, but it's its own document because it's the most substantive. See **[CALIBRATE.md](CALIBRATE.md)** for the walkthrough.

The short version: fill in `templates/PROJECT_CONTEXT.md`, `templates/SECURITY.md`, and `templates/ARCHITECTURE.md`, then fill the per-agent calibration slots inside each `agents/*.md` file. Without this, the agents fall back to generic advice; with it, you get findings that name your actual code.

You can skip CALIBRATE for the first PR review and the agents will still post something useful. But every hour you spend on calibration cuts the agents' false-positive rate by roughly the same amount.

---

## Step 10: Extend `_pwa` variants for your stack (optional)

If your project has conventions beyond what Alice and Bob already cover (a specific state-management library, a particular API pattern, internal naming conventions), add a `## Project-specific extensions` section at the bottom of `alice_security.md` and `bob_engineering.md`.

Keep it focused: only rules that would catch real bugs in your codebase, not style preferences.

---

## Step 11: Wire up scheduled agents (optional)

The weekly agents (`scrum_master`, `market_watch`, `hanging_refs`, `naming_audit`, `class_size_audit`, `security_audit`, optionally `prompt_audit`, plus `audit_groomer` which depends on the others) and the daily agents (`developer_agent`, `story_groomer`) can be triggered by GitHub Actions cron jobs or by Claude Code remote routines.

Example cron workflow for weekly agents:

```yaml
on:
  schedule:
    - cron: '0 9 * * 1'  # Mondays at 9am UTC
```

Or invoke manually via the Agent tool: `Agent({ subagent_type: 'scrum-master' })`.

---

## Minimal viable setup (if you want just the PR review)

1. Copy `agents/pr-review/` into `.claude/agents/` in your target repo.
2. Copy `workflows/pr-review.yml` into `.github/workflows/pr-review.yml`.
3. Replace `REPO_OWNER/REPO_NAME` in `workflows/pr-review.yml`.
4. Add the `CLAUDE_CODE_OAUTH_TOKEN` secret.
5. Confirm the `[bob_engineering, alice_security]` matrix is what you want (add `gomez_cleancode` and `carl_ux` if your project needs them).
6. Push to your default branch.

That's it. Alice and Bob will post on every PR automatically. Jekyll and Hyde follow once alice and bob have run.
