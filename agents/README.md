# Agents

Every file in this folder is a Claude Code subagent spec — a markdown file whose YAML frontmatter declares an agent name, description, allowed tools, and model, followed by the prose that tells the agent who it is and what to do. The installer copies these into a target repo's `.claude/agents/` folder; Claude Code finds them at runtime.

If you're orienting yourself for the first time, the folder splits three ways:

- **`pr-review/`** — six agents that fire on every pull request. Three first-pass reviewers (Alice for security, Bob for engineering principles, Gomez for line-level clean code), one optional UX reviewer (Carl, only useful when the project has a frontend), and two critics (Jekyll for whitehat best-practice challenges, Hyde for blackhat bypass attacks). All six run in a two-layer pipeline; see `workflows/pr-review.yml` and the diagram in `readme.md`.

- **`backlog/`** — four agents that run on a schedule and manage the issue tracker. `developer_agent` self-assigns one `ready` issue per day and opens a PR. `scrum_master` closes shipped issues weekly. `story_groomer` decomposes decision docs into stories and applies the `ready` label. `audit_groomer` turns weekly audit reports into pickup-ready issues.

- **`audits/`** — six read-only scanners that run weekly. `security_audit`, `hanging_refs`, `naming_audit`, `class_size_audit`, `market_watch`, and the optional `prompt_audit` (only useful for projects that ship LLM prompts). Each writes a timestamped report to `.claude/reports/`; the `audit_groomer` then turns those reports into issues.

Plus one agent that does not live in any subfolder: **`installer.md`** runs from a fresh clone of developer.ai itself and walks the adopter through a Q&A wizard to deploy the kit into their target repo. It's the entry point most people use, documented end-to-end in `INSTALL.md`.

## How to read an agent file

Every agent file follows the same shape:

1. **YAML frontmatter** — `name`, `description`, `tools`, `model`, and `effort`. The `description` is what the orchestrator reads to decide when to invoke the agent; the rest configures execution.
2. **The persona paragraph** — one or two paragraphs at the top in second-person ("You are Alice. A senior security engineer..."). This sets voice and stance.
3. **What you review** — scope rules: which files, which diff, what to read first.
4. **Source of truth** — the docs the agent must consult before forming opinions. This is where the kit's templates (`PROJECT_CONTEXT.md`, `SECURITY.md`, `ARCHITECTURE.md`, `ENGINEERING_PRINCIPLES.md`) get pulled in.
5. **What to look for** — the agent's actual rules, usually as numbered categories.
6. **How to post** — the mechanics of posting a GitHub review or writing a report.
7. **Behavior rules** — invariants (read-only on source, never `REQUEST_CHANGES`, never push to default branch).

If you're tweaking an agent, the section worth editing is usually "What to look for." The rest is stable across the fleet.

## Tag convention inside agent files

Sections that don't apply universally carry an HTML-comment tag:

```markdown
### 9. OAuth login flow integrity
<!-- tag: Architecture-Conditional; applies-when: has-frontend + has-auth -->
```

The installer reads these tags and either keeps the section, strips it, or comments it out based on the adopter's wizard answers. Four tag values: `Generic`, `Architecture-Conditional`, `Personal Preference`, `Domain-Specific`. The full convention is documented in `readme.md` "The tag convention" and in `agents/installer.md`.
