# Project Context

<!--
This file is the highest-leverage doc in the kit. Every agent reads it
before forming an opinion on your code.

It ships pre-filled with sensible defaults so the agents have something
to work with on day one. The installer adjusts the defaults during setup
based on your Q&A answers; you edit further if your project's reality
differs from the kit's assumptions.

Sections carry a tag in HTML comments when they're conditional:

  tag: Generic                                   . Applies regardless
  tag: Architecture-Conditional; applies-when: X. Included only when X
  tag: Personal Preference; default-on           . Kit's opinion; overridable

If you're reading the kit verbatim, all defaults are on.
-->

## What this project is

> Replace this paragraph with one sentence describing your project: what it does, who uses it, what makes it different. Vague answers here produce vague reviews; specific answers produce useful ones.

We are building a web application. Users sign in, interact with their workspace, and collaborate with teammates. The system has a frontend, a backend, a database, and a couple of helper services.

## Who uses it

> Replace with your actual users in one paragraph. The agents make UX, security, and scale judgments against this answer.

Small to medium teams (3 to 50 people). Each team has one shared workspace. Members sign in on a phone or laptop and spend most of their time reading and updating shared records. Sessions are typically 5 to 30 minutes long.

## How big it needs to be

> Override the band below if your project's scale is different. Findings that only matter at 10x or 100x your stated scale are noise; the agents check this before suggesting "this will fail at scale" rewrites.

We are designing for around 10,000 active users across a few thousand workspaces. Findings that only matter at extreme scale (millions of users, multi-region active-active deploys) are noise unless the change in front of us actually crosses that boundary.
<!-- tag: Personal Preference; default-on -->

## How we host it

We use self-hosted open-source software wherever it's reasonable. Managed identity providers (Auth0, Cognito, Clerk), managed databases (Supabase-hosted, Neon), and managed secrets stores are off the table because we want all user data to stay inside our own cluster. A pass-through edge service like Cloudflare is fine; transactional email through a paid sender is the one narrow exception.
<!-- tag: Personal Preference; default-on -->
<!-- override: if your project uses managed services (Auth0 for identity, hosted Postgres, etc.), replace this paragraph with what you actually use. The change affects what Jekyll and Alice are willing to recommend. -->

## How we deploy it

We deploy as plain containers, orchestrated by Docker Compose today and Kubernetes tomorrow. We do not use serverless platforms (Lambda, Cloud Functions) or platform-specific primitives (DynamoDB, Firestore). Whatever runs locally on a developer's laptop should also be able to run on a single rented server.
<!-- tag: Personal Preference; default-on -->
<!-- override: if your project is serverless-first or platform-coupled, replace this paragraph with the deployment shape you actually use. -->

## Our pieces (role-named services)

Every service has a **role name** that does not change even if we swap out the technology behind it. The `auth` container runs whichever identity provider we picked; the day we swap it out, no code or doc has to rename anything.

| Role name | What it does | Technology today |
|---|---|---|
| `frontend` | Web app the user sees in their browser | React + Vite |
| `api` | The backend API the frontend talks to | Node + Hono |
| `auth` | User login and session management | Keycloak |
| `datastore` | Persistent data (users, workspaces, records) | Postgres |
| `secrets` | Credentials for our other services | OpenBao |
| `worker` | Background jobs (email sends, report generation) | Node |
| `metrics` | Health and observability scrape target | Prometheus |

> Edit this table to match the services your project actually runs. Pick role names by what each thing does, not by what runs inside it.
<!-- tag: Generic -->

## What we don't do (the "not us" list)

- We don't use managed identity providers (Auth0, Cognito, Clerk, WorkOS).
- We don't use managed databases as a service (Supabase-hosted, Neon, PlanetScale).
- We don't deploy on serverless platforms (Lambda, Cloud Functions).
- We don't add a new microservice when we can extend an existing one.
- We don't build for backwards compatibility across our own clients. One frontend, always at the latest version.
- We don't add optional parameters "so old callers keep working." The compiler finds them all.
- We don't allow secrets in `.env` files committed to the repo; secrets live in the secrets service.

<!-- tag: Personal Preference; default-on -->
<!-- override: this list saves the agents from re-litigating settled decisions on every PR. Edit to match what your team has decided. If you drop a bullet, the agents stop treating it as "off the table" and may suggest it as an alternative. -->

## Default branch and bot identity

| Setting | Value |
|---|---|
| GitHub repo (owner/name) | `REPO_OWNER/REPO_NAME` |
| Default branch | `main` |
| Bot user (commits attributed to this name) | `github-actions[bot]` |

> The installer replaces these with your actual repo identity. If you set up the kit manually, edit them yourself before merging the first agent PR.

## How we label issues

The backlog agents key off labels. Defaults below; override only if your repo already uses these label names for something else.

| Purpose | Default label | Used by |
|---|---|---|
| Issue is ready for an agent to design | `ready` | story_groomer (adds), feature_agent (consumes) |
| Design is settled, ready to build | `build-ready` | story_groomer (adds), feature_agent (consumes) |
| Issue tracks a shipped PR | `[shipped]` | scrum_master |
| Issue tracks docs that drifted from code | `[doc-drift]` | scrum_master |
| Issue came from a `[story]` heading in a decision doc | `[story]` in heading text, not a GitHub label | story_groomer |
| Issue came from an audit finding | `audit-finding` | audit_groomer |
| Skip CI / agent review on this PR | `skip-ci` | pr-review workflow |

## Where the agents write their reports

| Setting | Value |
|---|---|
| Report folder | `.claude/reports/` |

The folder is gitignored except for `.claude/reports/.keep`, so reports stay local unless a workflow uploads them as an artifact. Don't change the path unless you have a reason; several agents hard-code it.
