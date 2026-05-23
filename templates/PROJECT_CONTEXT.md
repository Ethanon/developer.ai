# Project Context

This document gives every AI agent in the fleet (reviewers, audits, backlog bots) a short, opinionated picture of your project. It is the highest-value calibration doc — every agent reads it before forming an opinion on your code.

Fill in each slot below. Read the inline example after each slot for shape, then delete the example comment once you've filled the slot.

**Why this doc matters:** Without it, the agents fall back to generic advice — Alice flags "this route might be missing auth" instead of "this route skips your `requireSession` middleware, which your project's rule says every route under `routes/api/` must use." With it, you get findings that name your actual code.

> Setup time: 15-30 minutes. Treat it as a one-shot exercise. You can update it later if your project shifts.

---

## What this project is

{{PROJECT_DESCRIPTION}}

<!-- Example fill:
We are building a small team task tracker. Users sign in with email or
Google, join workspaces, and create projects with tasks and comments.
A web frontend talks to a backend API. The backend talks to a user-login
service, a database, and a couple of background workers.
-->

## Who uses it

{{TARGET_USERS}}

<!-- Example fill:
Small teams (3-30 people). Each team has one workspace. Members sign in
on a phone or laptop and spend most of their time reading and updating
tasks. We expect most sessions to be 5-15 minutes on a phone.
-->

## How big it needs to be

{{SCALE_TARGET}}

<!-- Example fill:
We are designing for around 10,000 active users across a few thousand
workspaces. Findings that only matter at extreme scale (millions of users,
multi-region active-active deploys) are noise unless the change in front
of us actually crosses that boundary.
-->

## How we host it

{{HOSTING_PHILOSOPHY}}

<!-- Example fill:
Self-hosted open-source only. Managed user-login services (Auth0, Cognito,
Clerk) and managed databases are off the table because we want all user
data to stay inside our own cluster. A pass-through edge service like
Cloudflare is fine. Paid transactional email is the one narrow exception.
-->

## How we deploy it

{{DEPLOYMENT_TARGET}}

<!-- Example fill:
Plain containers, orchestrated with Docker Compose today and Kubernetes
tomorrow. No serverless platforms (Lambda, Cloud Functions). No
platform-specific primitives (DynamoDB, Firestore). Whatever runs locally
should be able to run on a single rented server.
-->

## Our pieces (role-named services)

The containers / services in our project. Each one has a **role name** that does not change even if we swap out the technology behind it. Example: the `auth` container runs Keycloak today, but we still call it `auth` — so the day we swap to Authentik, no code or doc has to rename anything.

{{SERVICES_TABLE}}

<!-- Example fill:
| Role name | What it does | Technology today |
|---|---|---|
| `frontend` | Web app the user sees in their browser | React + Vite |
| `api` | The backend API the frontend talks to | Node + Hono |
| `auth` | User login and session management | Keycloak |
| `datastore-sql` | Relational data (users, workspaces, tasks) | Postgres |
| `secrets` | Keys and credentials for our other containers | OpenBao |
| `worker` | Background jobs (email sends, report generation) | Node |
| `metrics` | Prometheus scrape target for service health | Prometheus |
-->

## What we don't do (the "not us" list)

Decisions we have already made about things this project will not adopt. This list saves the agents (and humans) from re-litigating settled questions on every PR.

{{NOT_US_LIST}}

<!-- Example fill:
- We don't use managed identity providers (Auth0, Cognito, Clerk, WorkOS).
- We don't use managed databases as a service (Supabase-hosted, Neon).
- We don't deploy on serverless platforms.
- We don't add a new microservice when we can extend an existing one.
- We don't build for backwards compatibility across our own clients — one
  client, always at the latest version.
- We don't add optional parameters "so old callers keep working." The
  compiler finds them all.
-->

## Default branch and bot identity

The agents that file issues, open PRs, and push commits need to know your repo's identity.

| Setting | Value |
|---|---|
| GitHub repo (owner/name) | {{REPO_OWNER_NAME}} |
| Default branch | {{DEFAULT_BRANCH}} |
| Bot user (commits attributed to this name) | {{BOT_USER}} |

<!-- Example fill:
| GitHub repo (owner/name) | mycompany/tasks |
| Default branch | main |
| Bot user | github-actions[bot] |
-->

## How we label issues

Several backlog agents key off labels. The defaults work; override only if your repo already uses these label names for something else.

| Purpose | Default label | Used by |
|---|---|---|
| Issue is ready for an agent to pick up | `ready` | story-groomer (adds), developer-agent (consumes) |
| Issue tracks a shipped PR | `[shipped]` | scrum-master |
| Issue tracks docs that drifted from code | `[doc-drift]` | scrum-master |
| Issue came from a `[story]` heading in a decision doc | `[story]` (in heading text, not GitHub label) | story-groomer |

{{LABEL_OVERRIDES}}

<!-- Example fill (only if you change the defaults):
We use "needs-review" instead of "ready" because we already use "ready"
for something else. The agents have been updated to look for that label
instead.
-->

## Where the agents write their reports

Audit agents and the groomers write timestamped Markdown reports here. The folder is gitignored except for `.claude/reports/.keep`, so reports stay local unless a workflow uploads them as an artifact.

| Setting | Value |
|---|---|
| Report folder | {{REPORT_FOLDER}} |

<!-- Example fill:
`.claude/reports/` — keep the default unless you have a reason to move it;
several agents hardcode this path.
-->
