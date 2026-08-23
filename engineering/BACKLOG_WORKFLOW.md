# Backlog Workflow

The backlog is fully bot-managed. The human owner writes design docs and reviews PRs; everything else is automation.

---

## Backlog Policy

**The GitHub issue tracker is the single source of truth for actionable work.** Defects, refactors, security follow-ups, and deferred chores go straight into a GitHub issue. So does any "we should do X" item with a known shape that a bot or a human could pick up cold. Tag with `refactor`, `security`, `bug`, and so on, so the queue stays sortable. Do NOT create new `*_BACKLOG.md` files. Do NOT keep parallel TODO lists in design docs. Do NOT keep a markdown file as a backlog of work that has been thought through.

The two narrow exceptions where work can live outside the issue tracker:

1. **`docs/FUTURE_CONSIDERATIONS.md`** is reserved for concerns whose **next action is "write a design decision document,"** not "go build it." Entries are speculative-architectural, they carry a "trigger to revisit" condition, and they're explicitly NOT actionable until the trigger fires. If an entry has reached the point where a bot could just pick it up and write the code, it's a backlog item: promote it to the issue tracker.
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
| Audit Groomer | `audit-groomer` agent | Weekly | Reads the latest `security-audit`, `hanging-refs`, and `naming-audit` reports. Files one issue per CERTAIN finding. Issues are shaped to pass story-groomer's DoR so feature-agent can pick them up. |
| Audit bots | `security-audit` / `hanging-refs` / `naming-audit` / `class-size-audit` agents | Weekly | Read-only scanners. Write timestamped reports to `.claude/reports/`. |
| Feature | `feature-agent` agent | Daily | Pickup, design, build. Holds one unit of work at a time. Drafts a design PR from a `ready` issue and waits for the owner's `design-approved` label; builds a `build-ready` issue directly. Applies review feedback up to a 3-cycle cap. Never merges. |
| Reviewer | `alice_security` / `bob_engineering` / `jekyll_whitehat` / `hyde_blackhat` agents (plus optional `gomez_cleancode`, `carl_ux`) | On PR open | Auto-review the PR per `.github/workflows/pr-review.yml`. |

The human writes the design, sets `**Status:** Approved`, reviews the resulting PRs, and merges. Nothing else is required.

---

## Labels

Three of these dimensions are set by agents. Two are human triage only, and no bot
touches them.

### Who sets what

| Dimension | Cardinality | Set by | Removed by |
|---|---|---|---|
| **Type** | exactly one | the filer, or `story_groomer` if missing | not removed by agents |
| **Domain** | one or more | the filer, or `story_groomer` if missing | not removed by agents |
| **Readiness** | at most one | `story_groomer` only, grading the two gates below | `story_groomer` when reality breaks |
| **Lifecycle** | exactly one, on an open agent PR | `feature_agent` and the owner, alternating | `feature_agent` as it advances |
| **Milestone** | optional | human triage only | human |
| **Priority** | optional | human triage only | human |

Type is one of `feature`, `bug`, `enhancement`, `refactor`, `cleanup`. Domain is whatever
carves your codebase up usefully: `ui`, `api`, `data`, `infra`, `security`, `auth`, `docs`.
Pick the set once and keep it small. A domain label nobody filters on is noise.

Readiness is `ready`, `build-ready`, or `epic`. Milestone and priority are deliberately
outside every agent's reach, because they encode what you want next and no bot should get
a vote on that.

### Lifecycle labels: the PR state machine

The owner reads the pull-request window, not the issue tracker. So `feature_agent`
communicates the state of a unit of work through four labels on its one open PR, and the
owner drives it forward by adding two of them. Exactly one is present at a time.

| Label | Set by | State | Owner's next move |
|---|---|---|---|
| `design-pending` | agent | Draft PR holds only the design document, awaiting review. | Add `design-approved`, or leave comments and the agent revises. |
| `design-approved` | **owner** | Design accepted. Build it. | Wait. The agent builds and marks the PR ready for review. |
| `design-implementation` | agent | Built or building on the same branch. | Add `design-completed`, or leave notes and the agent addresses them. |
| `design-completed` | **owner** | Final approval given. | Merge it yourself once CI is green. No agent ever merges. |

A `build-ready` issue has a settled design already, so its PR skips the first two states and
opens at `design-implementation`.

The property worth preserving: **every transition that grants permission is the owner's.**
The agent can say "here is a design" and "here is the build," and nothing else moves without
a human adding a label.

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

## Definition of Ready: the two gates

`ready` means "there is enough here to start a design document." `build-ready` means "the
design is settled, go build it." They are different bars and an issue passes one or the
other, never both.

`story_groomer` grades every open issue against the **build bar** first. If it passes all
eight, the issue becomes `build-ready`. Otherwise the groomer grades the lower **design
bar**, and a pass there earns `ready`. An issue that fails both gets a comment naming the
criteria it failed, and stays open.

### Build bar: `build-ready`, all eight must pass

1. **Origin pointer present.** The body starts with `**Origin:**` citing a design doc, a PR, or a `scrum_master` marker.
2. **Clear scope statement.** What changes is explicit: file paths, symbol names, behaviour.
3. **Acceptance criteria.** What "done" looks like is named in the body.
4. **Bounded blast radius.** Roughly 20 files at most, and no more than two major packages. A larger change fails this bar and drops to the design bar, where the agent's design decomposes it.
5. **No new design needed.** The issue does not require a fresh design document.
6. **Reality check.** The symbols and paths the issue names exist where it says they do, unless the issue is creating them.
7. **Not an epic.** Shaped like one pull request, not an umbrella over several.
8. **The referenced design is settled.** Read the design doc the issue traces to. The sections it implements carry no unresolved markers (`TBD`, `TODO`, `open question`, `???`) and no undecided mechanism the build would have to pick on its own.

Criterion 8 is the one that earns its place. An autonomous agent cannot ask a clarifying
question halfway through a build, so an unsettled design does not fail loudly during
implementation. It gets guessed at. Sending the issue to the design bar instead means the
agent writes the design and the owner reviews it before any code exists.

### Design bar: `ready`, all four must pass

An issue that fails the build bar but is worth starting a design document for:

1. **Origin pointer present.** Same as build criterion 1.
2. **Clear problem or goal.** The body states the problem to solve or the outcome wanted, even where the mechanism is undecided. Named file paths are not required.
3. **Coherent scope.** One epic or one story, not a grab-bag. An epic passes: `ready` on an epic means "design it," and designing it is what decomposes it.
4. **Reality check.** Same as build criterion 6.

### When the grade changes

An issue that already carries a readiness label gets re-graded on later runs. If its reality
check breaks, because a merged PR deleted a symbol it names, the groomer removes the label
and explains why. The issue stays open. If a `ready` issue's design later becomes approved,
the groomer promotes it to `build-ready`.

---

## Things to do later: filing follow-ups during implementation

When work turns up that is genuinely out of scope, file a follow-up issue with
`**Origin:** PR #<this PR>` and a one-line note saying it was discovered during
implementation. Do not widen the current PR.

**Two things do not go here, and ship in the same PR instead:** code your change
supersedes, and dead code in a file your change already edits. See "Remove What You
Supersede" in [`ENGINEERING_PRINCIPLES.md`](ENGINEERING_PRINCIPLES.md). This outlet is for
drift in files your change does not otherwise touch.

`story_groomer` grades the follow-up on its next run like any other issue. This is the
primary answer to "we should do this later": the work is not lost, the current PR stays
scoped, and the new issue carries provenance back to the PR that surfaced it.

---

## What humans must NOT do

- **Don't manually add the `ready` label.** The groomer is the gate; manual tags bypass the DoR check.
- **Don't edit the `[story]` heading suffix in a decision doc.** It's the groomer's idempotency mark.
- **Don't merge bot PRs without review.** Alice / Bob / Jekyll / Hyde post on every PR; their feedback is advisory but worth reading. The merge is yours.
