# Pull Request Workflow

Rules for opening, greening, and shepherding a PR through review. Applies to humans and agents alike.

---

## Every change goes through a pull request

Every change to this repository lands via a pull request. Even one-line renames, em-dash cleanups, link fixes, and other "mechanical" changes go through a PR so the owner has a review window before code lands on the default branch.

**No direct pushes to the default branch.** The temptation is "this is too trivial to warrant a PR". That's the wrong call. The cost of opening a PR is seconds; the cost of bypassing the owner's review is a change landing without anyone looking at it. If the change is genuinely too trivial to review, it's also too trivial to need rushing past a PR.

The one exception is agents that explicitly have direct-push authorization documented in their own spec (the `story_groomer` and `audit_groomer` bots push `[story]` and `[#NN]` heading suffixes directly to the default branch as part of their idempotency contract). If an agent's spec does not name direct-push, the agent opens a PR.

Branch naming, commit messages, and any other PR mechanics live in the agent that opens the PR (see `agents/backlog/feature_agent.md` for the canonical pattern).

---

## Start every change in its own worktree

When more than one agent thread runs against a single checkout, they fight over it. A `git checkout`, `git reset`, or `git clean` in one thread silently reverts another thread's uncommitted edits to any file that differs between the two branches, and `git clean` deletes its untracked new files. The loss is silent and the thread that caused it never sees an error.
<!-- tag: Personal Preference; default-on -->
<!-- override: if you only ever run one agent thread against the repo at a time, this is ceremony you do not need. Drop the section and work on branches in the main checkout. -->

Before starting any change, create a dedicated worktree and work there:

```
git worktree add .worktrees/<name> -b <branch> <default-branch>
```

- Gitignore the worktree directory. One worktree per thread, named for the task.
- Remove the worktree when the branch merges: `git worktree remove .worktrees/<name>`.

**Share the dependency directory into the worktree rather than installing a second copy.** Link it with a directory symlink, or a junction on Windows, which needs no privilege. Do the linking from the package manager's own pre-install step. An agent harness that links dependencies for you covers only the worktrees *it* made. A pre-install hook covers every worktree, including ones a second AI tool created without ever reading your first tool's configuration.

Disk space is the smaller reason. On Windows, a real dependency tree inside a worktree is what makes that worktree undeletable. Nested package paths under an already-deep worktree path cross the 260-character limit, so `git worktree remove` fails with `Filename too long` after it has already unregistered the worktree. The directory then stays until somebody finds the incantation, and they accumulate.
<!-- tag: Ecosystem Specific; default-on -->
<!-- override: ecosystems that resolve dependencies from a project-external store by default (Go modules, Cargo, most JVM setups) already share them and need none of this. Drop both paragraphs. -->

**On Windows, turn long paths on once, and assert it in setup.** There are two switches and both are needed. `git config core.longpaths true` is per repository and needs no privilege. `LongPathsEnabled` under `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem` is per machine, needs an administrator, and is what everything other than git obeys. Setting only the first leaves your package manager failing on paths git now handles, which reads as a broken install rather than a path limit. Offer the elevation only when a human is at the terminal. A UAC prompt raised inside an agent's shell is a command that never returns.
<!-- tag: Platform Specific; default-on -->
<!-- override: teams developing exclusively on macOS or Linux have no 260-character limit. Drop the paragraph. -->

**Give each worktree its own ports, and its own name for anything else it starts.** Parallel threads collide on more than the checkout: a dev server, a database, an emulator, a browser profile. A port collision is the worst of these because it does not fail. The second bind loses, the first process keeps answering, and the losing thread reads another branch's output as its own. The `parallel-sessions` skill has the mechanism.
<!-- tag: Personal Preference; default-on -->
<!-- override: if your threads never start a long-running process, only the checkout can collide. Drop the paragraph. -->

---

## Open the PR, do not merge it

When work is ready, push the branch and open a pull request with a clear title and summary. The human owner handles all merges. Never call any merge API unsolicited, even when the PR looks "green". If merging is ever wanted, the human will ask explicitly.

---

## Prefer one larger PR over many stacked PRs

Each PR costs a full reviewer fan-out. Four small stacked PRs run the fleet four times over what is one logical unit of work, and every rebase after a parent merges triggers another run. The review context fragments too: a reviewer looking at PR 3 of 4 cannot see the foundation that PRs 1 and 2 laid, so it either re-derives it or flags things the earlier PRs already settled.
<!-- tag: Personal Preference; default-on -->
<!-- override: teams that merge continuously and review synchronously often prefer small PRs, and are right to. This rule assumes asynchronous agent review with a per-PR cost. -->

Default to one PR per logical unit of work. Split only when the split adds genuine review value: a foundation refactor landing before the consumers that depend on it, or a security-critical change isolated from refactoring noise so it can be reviewed on its own terms.

Sequence-stacked PRs, where each is based on the previous unmerged branch, are the specific shape to avoid. Every parent merge forces a rebase, and every rebase re-runs the fleet on the child.

---

## Tests come before the implementation, in the same PR

The PR ships the tests that pin the change, written before the implementation rather than after. This is the PR-level restatement of step 3 of the Working Loop in [`ENGINEERING_PRINCIPLES.md`](ENGINEERING_PRINCIPLES.md); the red-first discipline itself lives in the `test-driven-development` skill.
<!-- tag: Personal Preference; default-on -->
<!-- override: paired with the Working Loop. If you dropped that rule, drop this one too. -->

The test set traces to the change's acceptance criteria. If the design names a criterion with no corresponding test in the PR, the PR is incomplete: add the test, or say in the PR body why the criterion is out of scope for this one.

A PR whose tests were written after the code, or whose new behavior arrives with no test at all, is what `phil_testing` flags and what this rule exists to prevent.

---

## Green the CI before asking for review

After every push that opens or updates a PR, poll until every check run on the head commit reports `status: "completed"` AND `conclusion: "success"`.

If any check is `failure`, `cancelled`, `timed_out`, `action_required`, or `neutral`:

1. Fetch the failing job's logs.
2. Fix the root cause on the same branch.
3. Push.
4. Re-poll.

Do NOT hand the PR back to the human in a red or pending state. Only report "ready for review" once the check-runs response is all-green. A check still `in_progress` or `queued` is not green; wait it out or say so explicitly.

This applies to the initial PR open AND to every subsequent push on the same branch.

---

## Respond to review comments: decide with the owner before implementing

When review comments arrive, **do not start changing the PR.** The flow has three phases, and collapsing them is how a PR ends up churning through amend cycles.
<!-- tag: Generic -->

**Phase 1: wait until every check on the head commit has settled.** Every check reports completed, and every reviewer has posted. Acting on partial feedback forces another cycle when the late review lands, and burns a fresh fleet run on the next push for nothing.

**Phase 2: surface and recommend, do not act.** Pull every finding from every reviewer, plus every inline comment and every non-passing check, and produce a single table with one row per finding:

| # | Source and finding | Proposed fix | Recommendation: fix / don't fix / defer, and why |
|---|---|---|---|

The "why" cites something: a decision doc, a principle in this kit, a prior round's disposition. Then stop and wait. **The disposition call belongs to the PR owner, not the reviewer and not the author.** A reviewer asking for a change is not authorization to make it.

**Phase 3: apply exactly what was picked, then reply to every comment.** Make the changes on the same branch, push, and post an inline reply on every comment addressed: what changed and in which commit, what changed partially, or what is not changing and why. Declines are never silent. A reviewer whose finding is silently ignored has no way to tell the difference between "considered and rejected" and "missed."

This applies to every PR including an agent's own. If a comment is ambiguous or you disagree with it, that belongs in the table's recommendation column, not in a guess at implementation.

The `receiving-code-review` skill covers the conversational half of this: how to read a finding without capitulating to it, and how to disagree without being defensive.

---

## Update the design docs in the same PR

If the PR implements, changes, or supersedes a design decision, the doc updates land in the same PR, not as follow-up work. Out-of-sync decision status is the most common doc-drift bug; the cheapest moment to fix it is the same PR that ships the code.

Four cases the author owns before opening the PR:

1. **PR implements a `Proposed` or `Approved` decision.** Update the decision's `**Status:**` field to `Implemented` (when the PR lands the code) or `Landed` (when the PR also includes the integration / migration / rollout work). Add an `**Implemented by:**` line citing the PR number. A PR that adds the code without flipping the status leaves the decision permanently lying about its own state.

2. **PR contradicts an existing `Implemented` / `Landed` decision.** Two valid responses, both in the same PR:
   - **Edit in place**: when only details drifted (a renamed module, an updated threshold, a clarified rule). Update the decision so it matches the code.
   - **Supersede**: when the underlying architecture changed. Write a new numbered decision that names the predecessor, move the old one to `docs/decisions/historical/`, and update any other docs that point at the old one.

   Don't merge code that disagrees with an Implemented decision without also resolving the inconsistency. Future readers will trip over it; future agents will write more code based on the stale decision.

3. **PR changes a user-facing surface.** Link the UX design document in the PR body under `**Design:**`. A published design artifact, a Figma frame, or a written spec: what matters is that it is a stable link to the thing the implementation is supposed to match.

   <!-- tag: Architecture-Conditional; applies-when: has-frontend -->

   This link is what makes a UX review checkable. Without it, "is this good UX" is a matter of taste and a reviewer is guessing at intent; with it, the question becomes "does the implementation match what was agreed", which has an answer. `carl_ux` reads the link first and reviews conformance before anything else.

   Design first still applies. The document exists before the code, the same as a decision doc, and the PR links it rather than inventing it afterwards to justify what got built.

4. **PR introduces new architectural shape with no backing decision.** Write the one-paragraph decision doc in the same PR whenever it adds a new service, a new data flow, a new external dependency, a new cross-cutting pattern, or an abstraction the rest of the codebase does not have yet. It doesn't have to be long. It has to exist. A short decision with status `Implemented` and a one-paragraph rationale beats a 20-page decision written six months later from memory.

Bob's structural review catches most of these at PR time as a safety net. Don't rely on him: the author owns the doc updates.

---

## Keep the branch alive until merge

Do not delete the branch, force-push history the reviewer has already commented on, or rebase away review context without reason. Additional commits on top are preferred to rewriting history mid-review.
