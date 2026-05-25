# Pull Request Workflow

Rules for opening, greening, and shepherding a PR through review. Applies to humans and agents alike.

---

## Every change goes through a pull request

Every change to this repository lands via a pull request. Even one-line renames, em-dash cleanups, link fixes, and other "mechanical" changes go through a PR so the owner has a review window before code lands on the default branch.

**No direct pushes to the default branch.** The temptation is "this is too trivial to warrant a PR" — that's the wrong call. The cost of opening a PR is seconds; the cost of bypassing the owner's review is a change landing without anyone looking at it. If the change is genuinely too trivial to review, it's also too trivial to need rushing past a PR.

The one exception is agents that explicitly have direct-push authorization documented in their own spec (the `story_groomer` and `audit_groomer` bots push `[story]` and `[#NN]` heading suffixes directly to the default branch as part of their idempotency contract). If an agent's spec does not name direct-push, the agent opens a PR.

Branch naming, commit messages, and any other PR mechanics live in the agent that opens the PR (see `agents/backlog/developer_agent.md` for the canonical pattern).

---

## Open the PR, do not merge it

When work is ready, push the branch and open a pull request with a clear title and summary. The human owner handles all merges. Never call any merge API unsolicited, even when the PR looks "green". If merging is ever wanted, the human will ask explicitly.

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

## Respond to review comments and fix what's requested

When PR review comments arrive, read them in context, make the changes you find worth making, push, and leave a short reply noting what changed or why you didn't act. If a comment is ambiguous or you disagree, push back rather than reflexively complying.

The review agents post on every PR per `.github/workflows/pr-review.yml`:

- **Alice**: security (SECURITY.md, auth, cookies, XSS, SSRF, hardcoded secrets).
- **Bob**: engineering principles (god classes, naming, comments, over-abstraction, fail-loud).
- **Phil**: unit testing (test-first signal, intent-first naming, mocking discipline, failure-mode coverage).
- **Gomez** (optional): line-level clean code, names, density, idiom.
- **Carl** (optional, frontend-only): UX, mobile fit, copy, polish.
- **Jekyll**: whitehat critic of Alice / Bob / Phil / Gomez / Carl findings.
- **Hyde**: blackhat critic of the same.

Their feedback is advisory only. They never block merge; they post `APPROVE` or `COMMENT`, never `REQUEST_CHANGES`. You filter every finding through your own judgment.

The full rules covering how reviewers should behave (advisory not blocking, diminishing returns on later rounds, flagging fixes that are worse than the original) live in `engineering/ENGINEERING_PRINCIPLES.md` → "Review Etiquette — Advisory, Not Blocking". Read that if you're authoring a new reviewer agent or wondering why the second-round review came back quieter than the first.

---

## Update the design docs in the same PR

If the PR implements, changes, or supersedes a design decision, the doc updates land in the same PR — not as follow-up work. Out-of-sync decision status is the most common doc-drift bug; the cheapest moment to fix it is the same PR that ships the code.

Three cases the author owns before opening the PR:

1. **PR implements a `Proposed` or `Approved` decision.** Update the decision's `**Status:**` field to `Implemented` (when the PR lands the code) or `Landed` (when the PR also includes the integration / migration / rollout work). Add an `**Implemented by:**` line citing the PR number. A PR that adds the code without flipping the status leaves the decision permanently lying about its own state.

2. **PR contradicts an existing `Implemented` / `Landed` decision.** Two valid responses, both in the same PR:
   - **Edit in place** — when only details drifted (a renamed module, an updated threshold, a clarified rule). Update the decision so it matches the code.
   - **Supersede** — when the underlying architecture changed. Write a new numbered decision that names the predecessor, move the old one to `docs/decisions/historical/`, and update any other docs that point at the old one.

   Don't merge code that disagrees with an Implemented decision without also resolving the inconsistency. Future readers will trip over it; future agents will write more code based on the stale decision.

3. **PR introduces new architectural shape with no backing decision.** If the PR adds a new service, a new data flow, a new external dependency, a new cross-cutting pattern, or a new abstraction the rest of the codebase doesn't have yet — write the one-paragraph decision doc in the same PR. It doesn't have to be long. It has to exist. A short decision with status `Implemented` and a one-paragraph rationale beats a 20-page decision written six months later from memory.

Bob's structural review catches most of these at PR time as a safety net. Don't rely on him — the author owns the doc updates.

---

## Keep the branch alive until merge

Do not delete the branch, force-push history the reviewer has already commented on, or rebase away review context without reason. Additional commits on top are preferred to rewriting history mid-review.
