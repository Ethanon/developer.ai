# 071 — Maintenance bots run on GitHub Actions

**Date:** 2026-05-02
**Status:** Implemented
**Affects:** `.github/workflows/02-agent-*.yml` (one file per bot), one new repo secret.

---

## Problem

We run nine maintenance bots on daily and weekly schedules:

- **story-groomer** (daily): turns approved decision-doc sections into GitHub issues.
- **feature-agent** (daily): picks up a `ready` issue and opens a PR for it.
- **scrum-master** (weekly): closes shipped issues, opens drift-tracking issues.
- **audit-groomer** (weekly): converts audit reports into ready issues.
- **security-audit** (weekly): scans the codebase for security drift.
- **hanging-refs** (weekly): scans for dead imports and orphaned routes.
- **naming-audit** (weekly): scans for naming-contract violations.
- **class-size-audit** (weekly): flags oversized classes.
- **market-watch** (weekly): surveys ecosystem changes.

Until now the schedule lived in the maintainer's personal Claude Code "coworker routines": a per-developer config that fires the bots against the local repo on a clock the developer's own machine owns.

Two failure modes follow:

1. **The pipeline pauses whenever the maintainer's machine is off.** The backlog (issues filed by groomers, PRs opened by the feature-agent) is the spine of how work flows through this project; pausing it pauses everything else.
2. **Onboarding a second maintainer means re-creating the routines on their box.** The schedule is not in the repo, so it cannot be reviewed, version-controlled, or transferred.

We already invoke our PR-review bots (alice_security, bob_engineering, jekyll_whitehat, hyde_blackhat) from a GitHub Actions workflow on `pull_request`. The same action accepts a `schedule:` trigger; the migration is mechanical.

## Decision

Move every scheduled bot into a dedicated `.github/workflows/02-agent-*.yml` file driven by a cron schedule plus a manual-trigger button. **One file per bot.** The maintainer's personal routines list goes away once all nine workflows are merged.

### One file per bot, not a matrix

A matrix-style "run all bots from one workflow" was tempting and rejected. The bots differ on:

- **Cadence.** Daily for two bots; weekly for the rest, on different days.
- **Token.** Most need a fine-grained access token so their writes trigger downstream workflows. One bot (scrum-master) only touches issues and is fine on the built-in workflow token.
- **Failure handling.** feature-agent opens PRs that humans review; a runaway costs a wasted PR. security-audit writes a report we publish; a silent failure costs us the Monday-morning ping. The right retry, runtime budget, and on-failure handling are different per bot.
- **Concurrency keys.** story-groomer cannot run twice at once (its commits to `main` would race themselves). security-audit has no such constraint.

Collapsing all of this into one matrix-driven workflow forces the union of every difference into a config rendered as YAML. Per-bot files are mechanical (each is roughly 40 lines, mirroring the same skeleton) and editing one when its needs change is a single-file edit.

### Schedule (in UTC)

| Bot | Cadence | Cron | Eastern time |
|---|---|---|---|
| story-groomer | daily | `0 12 * * *` | 07:00 |
| feature-agent | daily | `0 13 * * *` | 08:00 |
| security-audit | weekly Monday | `0 9 * * 1` | 04:00 |
| hanging-refs | weekly Monday | `0 9 * * 1` | 04:00 |
| naming-audit | weekly Monday | `0 9 * * 1` | 04:00 |
| class-size-audit | weekly Monday | `0 9 * * 1` | 04:00 |
| audit-groomer | weekly Monday | `0 12 * * 1` | 07:00 (3 hours after audits) |
| scrum-master | weekly Monday | `0 13 * * 1` | 08:00 |
| market-watch | weekly Friday | `0 12 * * 5` | 07:00 |

The four audit scanners fire in parallel on Monday at 09:00 UTC. The audit-groomer waits three hours, which is generous slack: the audits typically finish in single-digit minutes. Three hours absorbs any GitHub Actions schedule skew (see "Failure mode" below) without the groomer ever reading a half-written report.

market-watch runs Friday so its report lands in time for a Friday-morning read.

Every workflow also exposes a manual-trigger button so the maintainer can fire any bot from the Actions tab without waiting for the next scheduled run.

### Tokens

Two tokens, one already built in:

| Token | Used by | Why |
|---|---|---|
| Built-in workflow token | scrum-master only | Files, closes, and comments on issues. None of these writes trigger another workflow, so the default-token restriction (writes by the built-in token don't fire downstream workflows) doesn't bite. |
| Project access token (in repo secret `BOT_TOKEN`) | every other bot | Two needs: writes that must fire downstream workflows (a story-groomer commit must trigger the report-notify workflow; a feature-agent PR must trigger the PR-review workflow), and the ability to push directly to the protected default branch. |

The project access token is fine-grained (`Contents: Read & Write`, `Issues: Read & Write`, `Pull requests: Read & Write`) scoped to this repo only. The maintainer adds it as a repo secret before merging the first workflow that needs it.

A GitHub App is the cleaner long-term shape (auto-rotation, narrower per-install scope, identifiable as a non-human in audit logs). Defer until the access-token surface becomes a real concern.

### Workflow shape

Every bot workflow follows the same skeleton:

1. A `schedule:` cron trigger plus a manual-trigger button.
2. A `concurrency:` key on the bot's name with `cancel-in-progress: false`. We do not want a manual run to abort a scheduled run mid-write; a duplicate run is cheaper than a partial commit.
3. The minimum `permissions:` the bot needs.
4. `actions/checkout@v4` with the project access token (for bots that push), or no token override (for scrum-master).
5. A preflight step that asserts the required secrets are present and fails fast with a clear error if not.
6. The Claude-Code action invocation, with a prompt that calls the bot.
7. An `upload-artifact` step capturing whatever the bot writes under `.claude/reports/`, with `if: always()` so a failed run still uploads partial output for debugging. Retention 30 days.

The workflow file is mechanical. Reasoning lives in this decision doc, not in YAML comments.

### Runtime budgets

GitHub Actions's `timeout-minutes` is the only wall-clock abort we have. Per-bot budgets:

| Bot | Timeout (minutes) |
|---|---|
| story-groomer | 15 |
| scrum-master | 15 |
| audit-groomer | 15 |
| security-audit | 15 |
| hanging-refs | 15 |
| naming-audit | 15 |
| class-size-audit | 15 |
| feature-agent | 25 |
| market-watch | 20 |

The feature-agent gets the largest budget because it does real source edits and waits on its own commit round-trip. market-watch gets 20 because every web-fetch adds latency. The seven scan-and-report bots finish in single digits; 15 minutes is a comfortable ceiling.

These numbers live in the workflow YAML, not in a shared config. Adjusting one is a one-line edit when a bot's runtime profile actually changes; pre-emptively centralizing them is premature optimization.

### Watchdog

A separate scheduled workflow, `.github/workflows/02-agent-watchdog.yml`, polls the Actions API once a day and pings the maintainer if any of the nine workflows is stale or has failed. The watchdog itself uses no Claude API. It's a small shell script that runs on the built-in workflow token.

The watchdog runs in **heartbeat mode**: it pings the maintainer every day, even when all nine bots are healthy. Healthy fires a default-priority "9/9 healthy" message; one or more alerts fires a high-priority message with per-bot detail. Heartbeat mode means the absence of the daily ping is itself a signal, if the watchdog itself stops running, the maintainer notices via missed heartbeats rather than via silence.

The watchdog is the bottom turtle: nothing watches the watchdog. Heartbeat mode is the answer to "what watches the watcher?"

### Failure mode (best-effort scheduling)

GitHub Actions does not guarantee a `schedule:` trigger fires at the requested minute. Two skew sources are documented: high load on the Actions service can delay or skip a run, and a workflow can be auto-disabled after 60 days of repository inactivity. Concretely:

- A daily run can land anywhere in a window of tens of minutes from the requested time. We treat this as "best effort, daily" rather than "fires at 12:00 UTC sharp."
- A scheduled run can be skipped entirely under heavy Actions load. The bot loop tolerates this: every bot is idempotent (groomers use idempotency markers, audit scanners overwrite same-day reports), so a skipped run becomes a doubled batch on the next run. No data is lost.
- After 60 days of no commits, GitHub auto-disables scheduled workflows. This repo commits multiple times daily, so this is not an active risk; if it ever becomes one, the maintainer re-enables the workflow from the Actions tab.

The 3-hour gap between the audit scanners and the audit-groomer absorbs even worst-case skew (a 30-minute delay still leaves completed reports).

If a critical schedule slip is ever observed, the manual-trigger button is a one-click recovery from the Actions tab.

## What we considered and rejected

- **Keep using personal Claude Code routines.** Rejected for the two failure modes in the Problem section.
- **A standalone scheduler container.** Rejected. We already operate enough containers; adding one whose only job is "run cron" is not worth it when GitHub Actions does this for free.
- **One workflow with a matrix of bots.** Rejected because the per-bot differences (cadence, token, timeout) outnumber the similarities.
- **A GitHub App instead of a project access token.** Rejected for now (cleaner long-term, but more setup work today). Revisit when the token-rotation cadence becomes a real concern.

## Trade-offs we accept

- **GitHub Actions is "best effort, daily" not "fires at 12:00 sharp."** We accept the skew because the bots are idempotent and a skipped run is recovered the next time.
- **Nine workflow files are more YAML than a matrix would be.** We accept the extra YAML because each file is mechanical and edits stay local when a single bot's needs change.
- **The maintainer holds a project access token in a repo secret.** We accept the surface area; rotation is the maintainer's responsibility until we move to a GitHub App.

## How we'll know if this was wrong

- The watchdog routinely pings about skipped runs. (Suggests Actions's skew is worse than we accepted; we'd add a recovery cron that re-fires the missed bot.)
- The project access token leaks. (Suggests we should accelerate the GitHub App migration.)

## Files affected

- `.github/workflows/02-agent-story-groomer.yml` (new)
- `.github/workflows/02-agent-developer.yml` (new)
- `.github/workflows/02-agent-scrum-master.yml` (new)
- `.github/workflows/02-agent-audit-groomer.yml` (new)
- `.github/workflows/03-audit-security.yml` (new)
- `.github/workflows/03-audit-hanging-refs.yml` (new)
- `.github/workflows/03-audit-naming.yml` (new)
- `.github/workflows/03-audit-class-size.yml` (new)
- `.github/workflows/03-audit-market-watch.yml` (new)
- `.github/workflows/02-agent-watchdog.yml` (new)
- Repo secret: `BOT_TOKEN` added by the maintainer.

All ten workflows land together in one PR. They share a single skeleton; the only inter-file differences are the bot name, the cron expression, the timeout, and the prompt body.
