# Architecture

<!--
Bob (the engineering reviewer), the audit agents, and the backlog bots
read this file as the source of truth for "what shape is this codebase?"
Findings that contradict your stated architecture are off-target — so
the clearer this doc names your shape, the fewer false positives you
get.

The file ships pre-filled with sensible defaults; the installer adjusts
during setup based on your Q&A answers. Override paragraphs that don't
match your project's reality.
-->

## The 60-second picture

Our frontend is a single-page web app served by a static file server. It talks to one backend API service, which acts as a login gateway to our auth service and as the only path to our database. Background work (emails, report generation) runs in a worker service that reads from the same database. Everything runs as plain containers, orchestrated by Docker Compose today. We deploy by pushing a new container image; we do not deploy individual source files.

> Rewrite this paragraph for your project. A reader new to the codebase should be able to read it in 60 seconds and walk away understanding the shape.
<!-- tag: Generic -->

## Services and their roles

| Role name | What it does | Talks to |
|---|---|---|
| `frontend` | Serves the static web app | (browser only) |
| `api` | Backend API; the only entry point to user data | `auth`, `datastore`, `secrets` |
| `auth` | User login (sign-in, sign-up, sessions) | `datastore`, external email |
| `datastore` | Relational database | (incoming only) |
| `secrets` | Stores credentials our services need | (incoming only) |
| `worker` | Background jobs | `datastore`, external email |
| `metrics` | Health metrics scraping | (incoming only) |

> Edit to match the services your project actually runs. The role-name column should not change when you swap technology.

## Data flow

A typical "load my workspace" request:

1. Browser sends `GET /api/workspaces/123` with a session cookie.
2. The `api` service's auth middleware reads the cookie, asks `auth` to verify the token, and attaches a `userId` plus `tenantId` to the request context.
3. The route handler reads from `datastore`, scoped to the user's tenant.
4. JSON response goes back to the browser.

A typical write looks the same shape, with the route handler writing back to `datastore` before responding. If the write needs a background follow-up (sending an email, generating a report), the route handler enqueues a job and returns `202` — the `worker` picks it up.

> Rewrite this section to walk through one common request in your project end-to-end. Concrete narrative beats an abstract diagram every time.
<!-- tag: Generic -->

## Layer responsibilities

- **Frontend** is display-only. No business logic, no rule enforcement. If the frontend needs a piece of derived data, it asks the API for it.
  <!-- tag: Architecture-Conditional; applies-when: has-frontend -->
- **API service** owns all business logic, authorization, and data validation. Every route runs through the same auth middleware. Every query is scoped to the caller's tenant.
  <!-- tag: Architecture-Conditional; applies-when: has-backend -->
- **Worker service** runs only jobs the API has enqueued. Workers never read user input directly; they read from the database and act on it.
  <!-- tag: Architecture-Conditional; applies-when: has-background-jobs -->
- **Datastore** holds no business logic. No stored procedures, no triggers beyond foreign-key constraints. All decisions live in the API.
  <!-- tag: Generic -->
- **Auth service** is operated by configuration, not by code in our repo. We do not write identity-provider plugins unless there is no other option.
  <!-- tag: Architecture-Conditional; applies-when: has-auth -->

## Decisions already made

Settled architectural decisions the agents should treat as given. Each gets one line. If a decision is large enough to need a paragraph, write a decision doc for it under `docs/decisions/` (see `templates/decisions/DECISION_TEMPLATE.md`) and link it here.

- **Backend is the login gateway.** Tokens never reach the browser; the browser only holds a session cookie. See `examples/decisions/004-auth-gateway.md`.
- **One API service.** No microservices today; we extend before we split.
- **Role-named services.** Services are named by what they do, not by what runs inside them.
- **All outbound external calls go through a thin client layer.** Business logic never imports an SDK directly. See `examples/decisions/028-client-layer.md`.
- **Critical-path errors propagate.** The server throws; the frontend shows the user a retry. We do not fabricate fallback data. See `examples/decisions/037-fail-loud.md`.
- **Maintenance bots run on GitHub Actions.** No separate scheduler. See `examples/decisions/071-scheduled-bots-on-github-actions.md`.

> Edit this list to match your project's settled decisions. Each line should point at a decision doc; the agents follow the links when they need detail.

## How we add a new piece

Before adding a new service, see if we can extend an existing one. A new service adds operational weight (one more thing to deploy, secure, back up, monitor). Examples of what stays in `api`: a new resource type, a new background job kind, a new external API integration. Examples of when a new service is justified: a new technology that does not fit the runtime (a Python ML model), or a clean isolation boundary (a new public webhook receiver with a different threat surface).

If a new service is the right call, follow the existing pattern: a role name in the service name; responsibilities documented in this file; secrets via the `secrets` service; structured logs to stdout; a health endpoint at `/healthz`.
<!-- tag: Personal Preference; default-on -->
<!-- override: a microservices-first team will disagree with "extend before split." If that's you, rewrite this section to match your team's actual default. -->

## What this doc is NOT

- Implementation details (those live in code).
- Operational runbooks (those live in `docs/runbooks/`).
- Hour-by-hour deployment history (that lives in git log).
