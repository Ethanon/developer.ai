# Adapting developer.ai to Your Project

This document walks through the one-time setup required to point the agent fleet at your GitHub repo. Most changes are search-and-replace; a few require decisions about your stack.

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
- `agents/backlog/scrum_master.md` — repo identity section
- `agents/backlog/developer_agent.md` — repo identity section
- `agents/backlog/story_groomer.md` — repo identity section
- `workflows/pr-review.yml` — fork guard condition

Also update the default branch name if yours is not `master` (e.g. change to `main`):
- `agents/backlog/scrum_master.md`
- `agents/backlog/developer_agent.md`
- `agents/backlog/story_groomer.md`
- `workflows/pr-review.yml`

---

## Step 3: Add the GitHub Actions secret

The PR review workflow needs a Claude Code OAuth token to run the agents.

1. Run `claude setup-token` locally to generate an OAuth token.
2. In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**
3. Name: `CLAUDE_CODE_OAUTH_TOKEN`
4. Value: the token from step 1.

The workflow checks for this secret and prints an error if missing.

---

## Step 4: Choose your agent variants

### PR review agents (alice, bob)

Two tiers:

- **Generic** (`alice_security.md`, `bob_engineering.md`): any TypeScript project.
- **PWA** (`alice_security_pwa.md`, `bob_engineering_pwa.md`): React + CSS Modules + BFF + OAuth/PKCE stack.

Update `workflows/pr-review.yml` to use the right variants:

```yaml
matrix:
  agent: [bob_engineering_pwa, alice_security_pwa]   # or [bob_engineering, alice_security] for generic
```

### Critique agents (jekyll, hyde)

These are generic — no variants needed. They critique whatever alice and bob post.

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

`alice.md` and `security-audit.md` read `docs/SECURITY.md` as the source of truth for your security model. Without it, alice falls back to generic OWASP guidance.

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
- `runs-on: ubuntu-latest` — change to `self-hosted` if you have your own runners
- `branches: [master]` — change to match your default branch
- Fork guard: the existing guard skips forks. Keep this; fork PRs can't safely access repo secrets.

---

## Step 8: Configure allowlists (optional)

Several agents read allowlist files to skip known-good patterns:

| File | Agent | Purpose |
|---|---|---|
| `.claude/hanging-refs-allowlist.md` | `hanging-refs` | Dynamic-dispatch patterns that look like dead refs |
| `.claude/naming-audit-allowlist.md` | `naming-audit` | Accepted non-standard names (domain nouns, React components) |
| `.claude/scrum-master-allowlist.md` | `scrum-master` | Issues/PRs that should never be auto-closed or auto-tracked |
| `.claude/developer-agent-allowlist.md` | `developer-agent` | Issues/paths the agent should never touch |
| `.claude/story-groomer-allowlist.md` | `story-groomer` | Issues or doc sections that should never get the `ready` label |

These files are created by agents when needed. You can also create them manually before the first run. Format is described in each agent's spec.

---

## Step 9: Extend alice_pwa / bob_pwa for your stack (optional)

If your project has conventions beyond the generic PWA defaults — a specific state management library, a particular API pattern, internal naming conventions — add a `## Project-specific extensions` section at the bottom of `alice_security_pwa.md` and `bob_engineering_pwa.md`.

Keep it focused: only rules that would catch real bugs in your codebase, not style preferences.

---

## Step 10: Wire up scheduled agents (optional)

The weekly agents (`scrum-master`, `market-watch`, `hanging-refs`, `naming-audit`, `class-size-audit`, `security-audit`) and the daily agents (`developer-agent`, `story-groomer`) can be triggered by GitHub Actions cron jobs or by Claude Code remote routines.

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
5. Choose `[bob_engineering, alice_security]` or `[bob_engineering_pwa, alice_security_pwa]` in the matrix.
6. Push to your default branch.

That's it. Alice and Bob will post on every PR automatically. Jekyll and Hyde follow once alice and bob have run.
