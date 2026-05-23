# Architecture

## The 60-second picture

Our frontend is a single-page React app served by a static file server. It talks to one backend API container, which acts as a login gateway to our auth service and as the only path to our database. Background work (emails, report generation) runs in a worker container that reads from the same database. Everything runs as plain containers, orchestrated by Docker Compose today. We deploy by pushing a new container image; we do not deploy individual source files.

## Containers and their roles

| Role name | What it does | Talks to |
|---|---|---|
| `frontend` | Serves the static web app | (browser only) |
| `api` | Backend API; the only entry point to user data | `auth`, `datastore-sql`, `secrets` |
| `auth` | User login (sign-in, sign-up, sessions) | `datastore-sql`, external email |
| `datastore-sql` | Relational database | (incoming only) |
| `secrets` | Stores credentials our containers need | (incoming only) |
| `worker` | Background jobs | `datastore-sql`, external email |
| `metrics` | Health metrics scraping | (incoming only) |

## Data flow

A typical "load my workspace" request:

1. Browser sends `GET /api/workspaces/123` with a session cookie.
2. The `api` container's auth middleware reads the cookie, asks `auth` to verify the token, and attaches a `userId` plus `tenantId` to the request context.
3. The route handler reads from `datastore-sql`, scoped to the user's tenant.
4. JSON response goes back to the browser.

A typical write looks the same shape, with the route handler writing back to `datastore-sql` before responding. If the write needs a background follow-up (sending an email, generating a report), the route handler enqueues a job and returns `202` — the `worker` picks it up.

## Layer responsibilities

- **Frontend** is display-only. No business logic, no rule enforcement. If the frontend needs a piece of derived data, it asks the API for it.
- **API container** owns all business logic, authorization, and data validation. Every route runs through the same auth middleware. Every query is scoped to the caller's tenant.
- **Worker container** runs only jobs the API has enqueued. Workers never read user input directly; they read from the database and act on it.
- **Datastore** holds no business logic. No stored procedures, no triggers beyond foreign-key constraints. All decisions live in the API.
- **Auth container** is operated by configuration, not by code in our repo. We do not write Keycloak plugins unless there is no other option.

## Decisions already made

- **Backend is the login gateway.** Tokens never reach the browser; the browser only holds a session cookie. See [`decisions/004-auth-gateway.md`](decisions/004-auth-gateway.md).
- **One API container.** No microservices today; we extend before we split.
- **Role-named services.** Containers are named by what they do, not by what runs inside them.
- **All outbound calls go through a thin client layer.** Business logic never imports an SDK directly. See [`decisions/028-client-layer.md`](decisions/028-client-layer.md).
- **Critical-path errors propagate.** The server throws; the frontend shows the user a retry. We do not fabricate fallback data. See [`decisions/037-fail-loud.md`](decisions/037-fail-loud.md).
- **Maintenance bots run on GitHub Actions.** No separate scheduler. See [`decisions/071-scheduled-bots-on-github-actions.md`](decisions/071-scheduled-bots-on-github-actions.md).

## How we add a new piece

Before adding a new container, see if we can extend an existing one. A new container adds operational weight (one more thing to deploy, secure, back up, monitor). Examples of what stays in `api`: a new resource type, a new background job kind, a new external API integration. Examples of when a new container is justified: a new technology that does not fit the runtime (a Python ML model), or a clean isolation boundary (a new public webhook receiver with a different threat surface).

If a new container is the right call, follow the existing pattern: a role name in the container name; responsibilities documented in this file; secrets via the `secrets` container; structured logs to stdout; a health endpoint at `/healthz`.

## What this doc is NOT

- Implementation details (those live in code).
- Operational runbooks (those live in `docs/runbooks/`).
- Hour-by-hour deployment history (that lives in git log).
