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

When PR review comments arrive, read them in context, make the requested changes on the same branch, push, and leave a short reply noting what changed. If a comment is ambiguous or you disagree with the suggested change, ask before implementing.

The four review agents post on every PR per `.github/workflows/pr-review.yml`:

- **Bob**: engineering principles (god classes, naming, comments, over-abstraction, fail-loud).
- **Alice**: security (SECURITY.md, auth, cookies, XSS, SSRF, hardcoded secrets).
- **Jekyll**: whitehat critic of Alice's and Bob's findings.
- **Hyde**: blackhat critic of Alice's and Bob's findings.

Their feedback is advisory but worth reading.

---

## Keep the branch alive until merge

Do not delete the branch, force-push history the reviewer has already commented on, or rebase away review context without reason. Additional commits on top are preferred to rewriting history mid-review.
