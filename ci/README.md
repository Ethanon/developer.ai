# CI on platforms other than GitHub

Pipelines and scripts for GitLab, Bitbucket, and Azure DevOps. GitHub Actions lives in
[`../workflows/`](../workflows/) and is the reference implementation; everything here mirrors
it as closely as each platform allows.

**These are stubbed against each platform's API and need your validation.** The payload
building in `post-review.mjs` is tested against a stub server for all three platforms, and
every script and pipeline file parses. The API shapes, variable names, and trigger semantics
come from each platform's documentation. Read
[What to check on the first run](#what-to-check-on-the-first-run) before you schedule
anything, and **please open an issue with what you find if you deploy this** — a report from
one real GitLab or Azure tenant is worth more than any amount of further reading on our
side.

---

## What ports, and what does not

| Tier | Ports? | Why |
|---|---|---|
| **Engineering principles** | Yes, completely | Markdown documents. No platform involved. |
| **Weekly audits** (8 agents) | Yes | They read the filesystem and write a report. Any runner that can run the Claude Code CLI runs them. |
| **PR reviewers** (Alice, Bob, Phil) | Yes, through the adapter here | The review logic is platform-independent; only the posting is not. |
| **Critics** (Jekyll, Hyde) | Yes, in a second stage | They read the first wave's review files off disk instead of reading comments back off the request. |
| **Backlog automation** (4 agents) | No | Built on GitHub Issues, GitHub labels, and a lifecycle state machine expressed in labels. Porting means redesigning it per tracker, not adapting it. |

An adopter on one of these platforms gets the principles, the audits, and five reviewers.
Only the backlog agents stay behind, and they stay behind because they drive an issue
tracker rather than because of anything about the runner.

### Why the critics are a stage and not a fourth parallel job

They critique what the first wave found. Run them beside Alice, Bob, and Phil and there is
nothing to critique yet, so they either invent findings or post nothing.

Staggering is native on all three platforms: a `stage` on GitLab, a second `parallel` block
on Bitbucket, a `dependsOn` stage on Azure. Within the second stage Jekyll and Hyde do run in
parallel with each other, because they are independent of one another.

The stage boundary is the only ordering constraint in this directory.

---

## The shape

Four scripts do the work, and the pipeline files are thin.

| Script | Job |
|---|---|
| `scripts/run-agent.sh` | Load a spec, strip its frontmatter, feed the body to the Claude Code CLI as the prompt. |
| `scripts/review-task.sh` | Emit the TASK block that tells a reviewer what to review and where to write it. |
| `scripts/critique-task.sh` | The same for a critic, plus the list of first-wave review files to read. |
| `scripts/post-review.mjs` | Post the review to the platform, and fail the job when nothing posted. |
| `scripts/<platform>-review.sh`, `scripts/<platform>-audit.sh` | Per-platform glue: work out the merge base, map the platform's variables onto the ones the poster reads. |

### The spec body is the prompt

`run-agent.sh` strips the YAML frontmatter and feeds the rest as the top-level prompt, so the
model runs **as** the reviewer.

The alternative, a prompt that says "invoke the alice_security subagent", gives the model a
decision to make, and the decision it often makes is that it has nothing to add. The job goes
green and no review appears. Removing the choice removes the failure. The GitHub workflow
does the same thing for the same reason.

### Write, then post

On GitHub a reviewer posts through the GitHub MCP tools. No equivalent exists here, so the
agent writes JSON and `post-review.mjs` posts it:

```json
{
  "summary": "### Alice - Security Review\n\nTwo findings.",
  "comments": [
    { "path": "src/invoices.ts", "line": 8, "body": "tenantId comes from the path, not the session." },
    { "body": "A finding with no single line posts unanchored." }
  ]
}
```

Splitting write from post buys three things. The
agent needs no network credential. An inline comment the API rejects falls back to an
unanchored one instead of vanishing. The file is still on disk when a run needs diagnosing,
and every pipeline here keeps it as an artifact whether the job passed or failed.

**Writing to disk is also what makes the critics work.** On GitHub, Jekyll and Hyde read the first wave's
comments back off the pull request to critique them. Here they read these files, which
arrive already carrying the path and line each finding was anchored to, so a critique threads
onto the right line without parsing a comment body to work out where it belongs. Critics
write `critique-<agent>.json` so their output never collides with the input they just read.

### Silence is a failure

`post-review.mjs` exits non-zero when the agent wrote no file, wrote an unparseable one, or
posted nothing.

That check is the same guard as `workflows/scripts/finalize-agent-review.sh`, for the same reason.
An agent that crashed, ran out of turns, or decided it had nothing to say produces exactly
what a clean review produces: no comments. You cannot tell "found nothing" from "never ran",
and the failure runs in the dangerous direction, because you merge believing the diff was
reviewed. **If you strip one thing from these pipelines, do not let it be this.**

---

## Setup

Each pipeline file carries its own setup block at the top. Common to all three:

1. Copy `ci/scripts/` into your repo at `ci/scripts/`.
2. Copy the agent specs into `.claude/agents/`. That directory name is Claude Code's
   requirement; set `AGENT_DIR` if yours live elsewhere.
3. Add `CLAUDE_CODE_OAUTH_TOKEN` as a masked variable, from `claude setup-token`.
4. Add the platform's own token, because none of the three default job tokens can post
   comments with the scope these need.

| Platform | Token variable | What it needs |
|---|---|---|
| GitLab | `GITLAB_TOKEN` | Project access token, `api` scope. `CI_JOB_TOKEN` cannot post discussions. |
| Bitbucket | `BITBUCKET_TOKEN` | Repository access token, `pullrequest:write`. |
| Azure DevOps | `AZURE_DEVOPS_TOKEN` | PAT with Code read and write, or `$(System.AccessToken)` once the build identity has "Contribute to pull requests". |

### Two traps worth naming

**Azure DevOps ignores `pr:` triggers on Azure Repos.** Add the pipeline as a Build
validation policy under Branch policies, or it will never fire on a pull request and nothing
will tell you why.

**Fork requests do not get your secrets, on any of the three.** GitLab's rule skips them
before any model call. Bitbucket and Azure let the job start, and `run-agent.sh` fails it on
the missing token. Both outcomes are correct; the GitLab one is quieter.

---

## Where these deliberately differ from GitHub

**Audit reports are published as artifacts, not committed.** On GitHub the agents commit
their reports, because `audit_groomer` reads them the next day and a report that lives only
in the runner is gone. The groomer does not port, so nothing downstream reads these: a person
does. Artifacts avoid giving the pipeline push credentials for a file only a human opens.

If you want them committed anyway, the audit scripts run with `Edit` in their tool list
already; add a commit and push step and grant the token write access to the repository.

**Five reviewers, not seven.** Gomez and Carl work fine here and are left out of the default
matrix for the same reason they are optional on GitHub: add them to the matrix when your
project benefits. Alice, Bob, Phil, Jekyll, and Hyde all run.

**No `skip-ci` label handling.** GitHub's workflow skips a PR carrying that label. Each
platform expresses this differently enough that guessing wrong would silently disable review,
so it is left out rather than half-done. Add your platform's condition to the review job.

---

## What to check on the first run

In order, because each one makes the next diagnosable:

1. **The job starts at all.** On Azure, this is the branch-policy trap above.
2. **The token check passes.** `run-agent.sh` fails loudly on a missing
   `CLAUDE_CODE_OAUTH_TOKEN`, and that message is the first thing worth seeing.
3. **A `review-<agent>.json` artifact exists.** If it does not, the agent produced nothing
   and the problem is in the prompt or the tool list, not the posting.
   For the critics, check that the second stage received those artifacts: the task block
   lists the files it found, and `(none: no first-wave reviewer produced a file)` on a run
   where the first wave clearly worked means the artifact handoff, not the agent.
4. **A comment appears on the request.** If the artifact exists but no comment does, read
   the poster's HTTP status line in the job log. A 401 or 403 is the platform token; a 400
   on an inline comment is a position the API rejected, and the fallback should already have
   posted it unanchored.
5. **The job fails when it should.** Force it: point `AGENT` at a name with no spec file. The
   job must go red. A pipeline that goes green on a missing agent is worse than no pipeline,
   because it reports a review that never happened.

---

## Adding a platform

1. Add a case to `platforms` in `scripts/post-review.mjs`. It returns a function from
   `(body, path, line)` to a request, and nothing else in the harness is platform-specific.
2. Write `scripts/<platform>-review.sh` and `scripts/<platform>-audit.sh`. Look at the
   Bitbucket pair: they work out the merge base and map platform variables onto the names the
   poster reads, and nothing else.
3. Write the pipeline file. Keep it thin. Every line of logic in YAML is a line that cannot
   be tested outside the platform.
4. Add a row to the token table above and to the tier table, honestly.
