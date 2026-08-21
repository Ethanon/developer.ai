# Agent Reliability

**An agent workflow that reports success has not told you it did anything.**

`anthropics/claude-code-action` exits 0 whether or not the agent posted a review, wrote a report, or made a single tool call. Every failure on this page looked green in the Checks panel, and each one was found by a person wondering why nothing appeared on the pull request rather than by CI.

This file exists because the kit shipped all six of these defects to every project installed from it. If you are extending the kit, treat the rules here as load-bearing; if you are debugging a quiet fleet, start at the table.

---

## The failure signature

| Symptom | Almost always |
| --- | --- |
| Job green, no review on the PR | One of the six below |
| `permission_denials_count > 0` in the execution log | Missing `--allowedTools` |
| Two or three turns, a few cents, `is_error: false` | The reviewer was never invoked |
| Agent ran, wrote a report, report is nowhere | Nothing committed it before the runner died |
| Some agents post, one never does | That agent's spec reads as permission to stay silent |
| Pods die mid-review on a self-hosted runner | Too many agent pods at once |

---

## The six rules

### 1. Always pass `--allowedTools`

Without it every tool call is refused and the run still exits 0. Posting a review *is* a tool call, so `mcp__github` is the entry that matters; omit it and a reviewer physically cannot post whatever it decides.

Observed 2026-08-17: seven turns, $0.46 spent, `permission_denials_count: 9`, nothing produced, job green.

Reviewers get no `Edit` and no `Write`. Every reviewer in this kit is read-only, and one that cannot write cannot rewrite the code it was asked to judge, whatever a prompt talks it into. Report-writing agents do need both.

### 2. Pin the model. Never use a floating alias

`sonnet` is an alias, not a version. It repointed from `claude-sonnet-4-6` to `claude-sonnet-5` in mid-2026 and fleets went silent **with no change on any adopter's side**. A pinned `claude-sonnet-5` cannot move under you.

Pin it per agent rather than once for the fleet. That column is also the staged-rollout lever: adopt a new model by flipping one reviewer as a canary, watch it on a live pull request, then flip the rest.

### 3. Run the reviewer *as* the agent, not through a wrapper

Do not prompt a top-level agent to "invoke the X subagent". That hop is a decision point, and models decline it: the top-level agent reads that the subagent decides whether to post, concludes it has nothing to add, and never spawns it.

Instead strip the YAML frontmatter from the agent's spec and make the body the prompt, with the task appended:

```yaml
- name: Load ${{ matrix.agent }} spec
  id: spec
  run: |
    {
      echo 'body<<REVIEWER_SPEC_EOF'
      awk 'BEGIN{c=0} /^---$/ && c<2 {c++; next} c>=2{print}' ".claude/agents/${{ matrix.agent }}.md"
      echo 'REVIEWER_SPEC_EOF'
    } >> "$GITHUB_OUTPUT"
```

### 4. Say that silence still means posting

Newer models follow instructions more literally. A spec that says "stay silent when you have nothing to add" or "do not repeat findings that appear in existing reviews" gets read as *post nothing* — so the agent posts nothing, and is right to by its own instructions.

Every task prompt must say, in the workflow rather than only in the spec:

> If you have nothing to flag, post an APPROVE whose body is your header banner — a "stay silent" rule still means a one-line APPROVE, never zero posts. "Do not repeat existing findings" means do not re-list them in your body; it never means do not post. Never end this run without posting a review.

### 5. Verify the agent posted, and fail the job when it did not

Rules 2 through 4 are prompt and configuration, and both drift. This one does not, which makes it the only durable member of the list. **If you keep one rule from this page, keep this one.**

`.github/scripts/finalize-agent-review.sh` asks the pull request whether a review carrying this agent's header exists on this head SHA, and exits non-zero when it does not. It also keeps the execution log for 14 days, because a silent run with no log leaves nothing to read but a green tick.

Do not try to infer this from the execution log's tool-call count. A reviewer's real work runs inside a subagent, so the top-level log records the spawn and always looks busy — the count is above zero exactly when you most need it to be zero.

A `null` result — the API was unreachable — is treated as "posted". A GitHub hiccup must never fail a reviewer that did its job.

### 6. Cap `max-parallel`

Each agent pod runs a review alongside a dind sidecar. Five at once oversubscribed a self-hosted node and got pods OOM-killed mid-review, which presents as a silent agent. `max-parallel: 2` costs little wall clock, because these agents wait on an API rather than on a CPU.

---

## A report that is not committed does not exist

Scheduled agents write to `.claude/reports/`. A runner is ephemeral, so a report written and not pushed is gone when the job ends — and any groomer that reads "the latest report from each source bot" then finds nothing, forever, while every job reports success.

Every report-writing prompt must end with the commit, not just the write:

> Write the report under `.claude/reports/`, then commit and push it. A report left only in the runner is gone when the job ends.

---

## Before you ship a change to any agent workflow

1. Does every `claude_args` block pass `--allowedTools`?
2. Is every model a pinned version rather than an alias?
3. Does the prompt run the agent directly, with no "invoke the subagent" hop?
4. Does the task text say that having nothing to say still means posting?
5. Does a run that posts nothing fail the job?
6. If the agent writes a file, does the prompt tell it to commit and push?

**A pull request that edits the review workflow cannot test it.** `claude-code-action` refuses to run when the workflow file differs from the default branch, so a PR could not rewrite the workflow to exfiltrate secrets. Jobs report success having skipped the action entirely. Verify on the next pull request that touches no workflow file, and treat green on the workflow PR itself as meaning nothing.
