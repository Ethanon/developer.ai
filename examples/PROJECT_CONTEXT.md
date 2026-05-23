# Project Context

## What this project is

We are building a small team collaboration app. Users sign in with email and password (or "Sign in with Google"), join a workspace with their teammates, and create projects, tasks, and comments. A web frontend talks to a backend API. The backend talks to a user-login service, a database, and a couple of background workers that handle email and report generation.

## Who uses it

Small teams of three to thirty people. Each team has one workspace; we will add multiple-workspace support later if customers ask. Members sign in on a phone or laptop and spend most of their time reading and updating tasks. Most sessions are five to fifteen minutes on a phone.

## How big it needs to be

We are designing for around 10,000 active users across a few thousand workspaces. Findings that only matter at extreme scale (millions of users, multi-region active-active deploys) are noise unless the change in front of us actually crosses that boundary.

## How we host it

Self-hosted open-source only. Managed user-login services (Auth0, Cognito, Clerk) and managed databases are off the table because we want all user data to stay inside our own cluster. A pass-through edge service like Cloudflare is fine. Paid transactional email is the one narrow exception (Postmark today, swappable).

## How we deploy it

Plain containers, orchestrated with Docker Compose today and Kubernetes tomorrow. No serverless platforms. No platform-specific primitives. Whatever runs locally on a developer's laptop should also be able to run on a single rented server.

## Our pieces (role-named services)

Every container has a **role name** that does not change even if we swap the technology behind it. The `auth` container runs Keycloak today, but we still call it `auth` — so the day we swap to Authentik, no code or doc has to rename anything.

| Role name | What it does | Technology today |
|---|---|---|
| `frontend` | Web app the user sees in their browser | React + Vite |
| `api` | The backend API the frontend talks to | Node + Hono |
| `auth` | User login and session management | Keycloak |
| `datastore-sql` | Relational data (users, workspaces, tasks) | Postgres |
| `secrets` | Keys and credentials for our other containers | OpenBao |
| `worker` | Background jobs (email sends, report generation) | Node |
| `metrics` | Prometheus scrape target for service health | Prometheus |

## What we don't do (the "not us" list)

- We don't use managed identity providers (Auth0, Cognito, Clerk, WorkOS).
- We don't use managed databases as a service (Supabase-hosted, Neon).
- We don't deploy on serverless platforms (Lambda, Cloud Functions).
- We don't add a new microservice when we can extend an existing one.
- We don't build for backwards compatibility across our own clients — one frontend, always at the latest version.
- We don't add optional parameters "so old callers keep working." The compiler finds them all.

## Default branch and bot identity

| Setting | Value |
|---|---|
| GitHub repo (owner/name) | `our-org/our-app` |
| Default branch | `main` |
| Bot user (commits attributed to this name) | `github-actions[bot]` |

## How we label issues

| Purpose | Default label | Used by |
|---|---|---|
| Issue is ready for an agent to pick up | `ready` | story-groomer (adds), developer-agent (consumes) |
| Issue tracks a shipped PR | `[shipped]` | scrum-master |
| Issue tracks docs that drifted from code | `[doc-drift]` | scrum-master |
| Issue came from a `[story]` heading in a decision doc | `[story]` in heading text | story-groomer |

We use the defaults. No overrides.

## Where the agents write their reports

| Setting | Value |
|---|---|
| Report folder | `.claude/reports/` |

The folder is gitignored except for `.claude/reports/.keep`, so reports stay local unless a workflow uploads them as an artifact.
