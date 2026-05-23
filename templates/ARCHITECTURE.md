# Architecture

This document describes how the pieces of your project fit together. Bob (the engineering reviewer), the audit agents, and the backlog bots read it as the source of truth for "what shape is this codebase?" Findings that contradict your stated architecture are off-target — so the more clearly this doc names your shape, the fewer false positives you get.

Fill in each slot. Read the inline example after each slot for shape, then delete the example comment once you've filled the slot.

> Setup time: 20-30 minutes. The hardest part is usually the layer-responsibilities section; copy from the example and adjust.

---

## The 60-second picture

A short paragraph any reader (new teammate, AI agent, future-you) can read in a minute and walk away understanding the shape.

{{ONE_PARAGRAPH_OVERVIEW}}

<!-- Example fill:
Our frontend is a single-page React app served by a static file server.
It talks to one backend API container, which acts as a login gateway to
our auth service and as the only path to our database. Background work
(emails, report generation) runs in a worker container that reads from
the same database. Everything runs as plain containers, orchestrated by
Docker Compose today. We deploy by pushing a new container image; we do
not deploy individual source files.
-->

## Containers and their roles

One row per container or service. The role name is what we always call it; the technology may change.

{{CONTAINERS_TABLE}}

<!-- Example fill:
| Role name | What it does | Talks to |
|---|---|---|
| `frontend` | Serves the static web app | (browser only) |
| `api` | Backend API; the only entry point to user data | `auth`, `datastore-sql`, `secrets` |
| `auth` | User login (sign-in, sign-up, sessions) | `datastore-sql`, external email |
| `datastore-sql` | Relational database | (incoming only) |
| `secrets` | Stores credentials our containers need | (incoming only) |
| `worker` | Background jobs | `datastore-sql`, external email |
| `metrics` | Health metrics scraping | (incoming only) |
-->

## Data flow

How a user request becomes a response. Walking through one common request end-to-end is more useful than a diagram with no narrative.

{{REQUEST_FLOW_NARRATIVE}}

<!-- Example fill:
A typical "load my workspace" request:

1. Browser sends `GET /api/workspaces/123` with a session cookie.
2. The `api` container's auth middleware reads the cookie, asks `auth`
   to verify the token, and attaches a `userId` + `tenantId` to the
   request context.
3. The route handler reads from `datastore-sql`, scoped to the user's
   tenant.
4. JSON response goes back to the browser.

A typical write looks the same shape, with the route handler writing
back to `datastore-sql` before responding. If the write needs a
background follow-up (sending an email, generating a report), the route
handler enqueues a job and returns 202 — the `worker` picks it up.
-->

## Layer responsibilities

Which layer owns which kind of logic. This is the section the engineering reviewer leans on most. Be specific: "the API container owns business logic; the frontend is display-only" is the right shape.

{{LAYER_RULES}}

<!-- Example fill:
- **Frontend** is display-only. No business logic, no rule enforcement.
  If the frontend needs a piece of derived data, it asks the API for it.
- **API container** owns all business logic, authorization, and data
  validation. Every route runs through the same auth middleware. Every
  query is scoped to the caller's tenant.
- **Worker container** runs only jobs the API has enqueued. Workers
  never read user input directly; they read from the database and act
  on it.
- **Datastore** holds no business logic — no stored procedures, no
  triggers beyond foreign-key constraints. All decisions live in the
  API.
- **Auth container** is operated by configuration, not by code in our
  repo. We do not write Keycloak plugins unless there is no other
  option.
-->

## Decisions already made

Settled architectural decisions the agents should treat as given. Each gets one line. If a decision is large enough to need a paragraph, write a decision doc for it under `docs/decisions/` (see `templates/decisions/DECISION_TEMPLATE.md`) and link it here.

{{DECISIONS_INDEX}}

<!-- Example fill:
- **Backend is the login gateway.** Tokens never reach the browser; the
  browser only holds a session cookie. See `docs/decisions/004-auth-gateway.md`.
- **One API container.** No microservices today; we extend before we
  split. See `docs/decisions/002-single-api.md`.
- **Role-named services.** Containers are named by what they do, not by
  what runs inside them. See `docs/decisions/001-role-names.md`.
- **All AI calls go through a thin client layer.** Business logic never
  imports an SDK directly. See `docs/decisions/028-adapter-client.md`.
- **Critical-path errors propagate.** The server throws; the frontend
  shows the user a retry. We do not fabricate fallback data. See
  `docs/decisions/037-fail-loud.md`.
-->

## How we add a new piece

A short recipe for "I need a new container / service / surface — what's the right shape?" Future-you reads this whenever you're tempted to do something different.

{{HOW_TO_EXTEND}}

<!-- Example fill:
Before adding a new container, see if we can extend an existing one. A
new container adds operational weight (one more thing to deploy, secure,
back up, monitor). Examples of what stays in `api`: a new resource type,
a new background job kind, a new external API integration. Examples of
when a new container is justified: a new technology that does not fit
the runtime (a Python ML model), or a clean isolation boundary (a new
public webhook receiver with a different threat surface).

If a new container is the right call, follow the existing pattern:
role name in the container name, its responsibilities in this file,
secrets via `secrets`, structured logs to stdout, a health endpoint at
`/healthz`.
-->

## What this doc is NOT

A short list of things that explicitly do not belong in this doc, so it stays useful instead of becoming a wiki. Examples:

- Implementation details (those live in code).
- Operational runbooks (those live in `docs/runbooks/`).
- Hour-by-hour deployment history (that lives in git log).
