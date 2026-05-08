# Backlog Workflow

The backlog is fully bot-managed. The human owner writes design docs and reviews PRs; everything else is automation.

---

## Backlog Policy

**The GitHub issue tracker is the single source of truth for actionable work.** Defects, refactors, security follow-ups, deferred chores, and any "we should do X" item that has a known shape and could be picked up cold by a bot or a human go straight into a GitHub issue. Tag with `refactor`, `security`, `bug`, etc. so the queue stays sortable. Do NOT create new `*_BACKLOG.md` files, do NOT keep parallel TODO lists in design docs, and do NOT keep a markdown file as a backlog of work that's been thought through.

The two narrow exceptions where work can live outside the issue tracker:

1. **`docs/FUTURE_CONSIDERATIONS.md`** is reserved for concerns whose **next action is "write a design decision document,"** not "go build it." Entries are speculative-architectural, they carry a "trigger to revisit" condition, and they're explicitly NOT actionable until the trigger fires. If an entry has reached the point where a bot could just pick it up and write the code, it's a backlog item — promote it to the issue tracker.
2. **`docs/decisions/NNN-*.md`** is the design-decision history. Decision docs describe reasoning and shape, not work to do.

When tempted to "add this to the backlog doc," stop. Open an issue instead. The bots are reading the issue tracker.

---

## Design Documentation Rule

When a planning session produces an approved implementation plan, **save it as a design decision document** in `docs/decisions/` before implementing. Number sequentially (001, 002, ...). Include: date, context, decisions made, architecture details, and files affected.

**Extend the existing decision when the change is part of the same architectural choice.** If you are filling in a gap that an earlier decision flagged as a TODO, edit the original decision document in place rather than minting a new number. New numbers are for genuinely new architectural choices.

---

## Roles in the pipeline

| Role | Owner | Cadence | Job |
|---|---|---|---|
| Architect | Human | Continuous | Write design docs. Set the `**Status:**` field on each decision doc. |
| Scrum Master | `scrum-master` agent | Weekly | Tracker bookkeeping: file `[shipped]` history issues for merged PRs, close issues whose work landed, file `[doc-drift]` issues when docs and code diverge. Does not author stories. |
| Story Groomer | `story-groomer` agent | Daily | Story lifecycle. Mode A: read approved design docs, identify story-shaped sections, suffix the heading with `[story]`, file an issue per tagged section. Mode B: evaluate every open issue against the Definition of Ready and add the `ready` label when it passes. |
| Audit Groomer | `audit-groomer` agent | Weekly | Reads the latest `security-audit`, `hanging-refs`, and `naming-audit` reports. Files one issue per CERTAIN finding. Issues are shaped to pass story-groomer's DoR so developer-agent can pick them up. |
| Audit bots | `security-audit` / `hanging-refs` / `naming-audit` / `class-size-audit` agents | Weekly | Read-only scanners. Write timestamped reports to `.claude/reports/`. |
| Developer | `developer-agent` agent | Daily | Pickup. Pulls one `ready`-tagged issue, opens a PR, applies review feedback up to a 3-cycle cap. Never merges. |
| Reviewer | `alice` / `bob` / `jekyll` / `hyde` agents | On PR open | Auto-review the PR per `.github/workflows/pr-review.yml`. |

The human writes the design, sets `**Status:** Approved`, reviews the resulting PRs, and merges. Nothing else is required.

---

## Weekly market scan

Upstream of the pipeline: the `market-watch` agent runs weekly and writes `.claude/reports/market-watch-<YYYY-MM-DD>.md`. It surfaces engineering-practice and tech-ecosystem market shifts at four severity bands (Critical / High / Medium / Low), with Added / Removed / Implemented deltas across recent reports and an opinionated Recommended action per item. It never files issues, never opens PRs, never edits source.

---

## How issues come into existence

Every issue in the tracker MUST trace back to one of:

- A **decision document** in `docs/decisions/`: issues filed by `story-groomer` Mode A from sections it tagged `[story]`.
- A **PR**: issues filed by humans or agents when implementation surfaces a follow-up out of the current PR's scope.
- A **scrum-master automation**: `[shipped]` tracking issues, `[doc-drift]` issues. The marker in the issue body is the origin.
- An **audit-groomer automation**: issues filed from `security-audit` / `hanging-refs` / `naming-audit` reports.

Every non-scrum-master issue body MUST start with an `**Origin:**` line:

```
**Origin:** docs/decisions/056-auth-migration.md (### Phase 1: Token storage [story])
```
or
```
**Origin:** PR #76 (deferred from review-cycle 2)
```

Issues without an origin fail the Definition of Ready and never get the `ready` label.

---

## The `## Heading [story]` convention

Decision docs use H3 headings (`### `) for the story-shaped sections that should become issues. The story-groomer suffixes the heading with `[story]` after filing the corresponding issue:

```markdown
### Phase 1: Foundation tokens [story]

Files: src/styles/tokens.css, src/styles/global.css.

Acceptance: new design tokens replace the old palette; existing contrast ratios stay WCAG AA.

Scope: tokens only; no component edits in this phase.
```

A heading without `[story]` is one of: a section the groomer hasn't gotten to yet, a section the groomer judged not story-shaped, or a section in a doc whose `**Status:**` is `Draft` / `Proposed` / `Exploring`.

The groomer NEVER edits the body content of a decision doc. It only suffixes H3 headings with `[story]`. Doc prose is human-only.

---

## Definition of Ready (7 criteria)

The `story-groomer` Mode B applies these to every open issue without the `ready` label. ALL seven must pass:

1. **Origin pointer present.** Body starts with `**Origin:**` citing a decision doc, a PR, or a scrum-master marker.
2. **Clear scope statement.** What changes — file paths, symbol names, behavior — is explicit.
3. **Acceptance criteria.** What "done" looks like is named in the body.
4. **Bounded blast radius.** No more than ~20 files affected; does not span 2+ major packages simultaneously.
5. **No new design needed.** The issue does not require a fresh decision doc.
6. **Reality check.** Symbols and paths the issue names actually exist where named (or the issue is a creation-from-scratch).
7. **Not an epic.** Single-PR-shaped, not an umbrella.

---

## What humans must NOT do

- **Don't manually add the `ready` label.** The groomer is the gate; manual tags bypass the DoR check.
- **Don't edit the `[story]` heading suffix in a decision doc.** It's the groomer's idempotency mark.
- **Don't merge bot PRs without review.** Alice / Bob / Jekyll / Hyde post on every PR; their feedback is advisory but worth reading. The merge is yours.
