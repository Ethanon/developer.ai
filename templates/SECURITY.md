# Security Model

This document describes how your project handles user identity, sessions, secrets, and the boundaries between trusted and untrusted code. Alice (the security review agent) and the security audit bot read it as their source of truth — every security finding they raise is grounded in something this doc says (or in the OWASP list of common web vulnerabilities, when this doc is silent).

Fill in each slot. Read the inline example after each slot for shape, then delete the example comment once you've filled the slot.

> Setup time: 20-40 minutes. This is the second-highest-ROI doc to fill in (after `PROJECT_CONTEXT.md`). A well-filled SECURITY.md cuts Alice's false-positive rate by something like 80%.

---

## Trust boundaries

Who and what does this project trust? Everything else is untrusted by default.

{{TRUST_BOUNDARIES}}

<!-- Example fill:
**Trusted:**
- Our own containers running inside our cluster, talking to each other
  over the internal network.
- Our auth service's signed tokens (we verify the signature on every
  request).
- Our datastore's responses (we wrote what's in there).

**Untrusted:**
- The browser, and anything coming from it (headers, cookies, body,
  query params, URL path segments). Validated at the API edge before
  it reaches business logic.
- External APIs we call (email provider, analytics). Treat responses
  as untrusted input; never write them to the database without
  validation.
- Anything in a request that claims to identify the user (a `userId`
  in the body, a `tenantId` in a query param). We always derive
  identity from the session, never from the request.
-->

## How users sign in

Walk through the sign-in flow end-to-end. Concrete is better than abstract.

{{LOGIN_FLOW}}

<!-- Example fill:
Our backend runs an `auth` container that holds our identity provider
(Keycloak, self-hosted). The browser never sees a login token directly.
The `api` container acts as a login gateway:

1. The browser hits `/auth/login` on the API.
2. The API redirects to the `auth` container's sign-in page.
3. The user enters their email and password (or clicks "Sign in with
   Google"); the `auth` container verifies them.
4. The `auth` container redirects back to `/auth/callback` on the API
   with a temporary code.
5. The API exchanges that code for a signed access token plus a
   long-lived refresh token (server-to-server with the `auth` container).
6. The API sets two cookies on the browser: an `HttpOnly` access-token
   cookie (15-minute lifetime) and an `HttpOnly` refresh-token cookie
   (30-day lifetime, scoped to `/auth/refresh`).
7. Subsequent requests carry the cookies. The API verifies the access
   token on every request and, when it expires, the frontend hits
   `/auth/refresh` to get a new pair.

This is sometimes called the "backend-for-frontend" pattern. The reason
to bother: the browser never holds a real token in JavaScript, which
closes off a whole class of browser-side attacks.
-->

## How requests are authorized

Every protected route runs through the same middleware. Describe what that middleware checks and what it attaches to the request.

{{AUTHORIZATION_MODEL}}

<!-- Example fill:
Every route under `/api/*` runs through one middleware (`requireSession`)
that:

1. Reads the access-token cookie.
2. Verifies the signature against the auth container's public keys.
3. Looks up the user record in our database (one indexed read).
4. Attaches `userId` + `tenantId` + `roles` to the request context.

Routes derive identity from the context, never from the request body.
A route that reads `tenantId` from the body is a finding.

For multi-tenant data, every database query is scoped by `tenantId`
from the context. We use a small helper (`scoped(tenantId).from('tasks')`)
that no route is allowed to bypass.
-->

## How we store secrets

Where credentials, API keys, and signing keys live, and how each service reads them.

{{SECRETS_MODEL}}

<!-- Example fill:
We run a `secrets` container (OpenBao, the open-source Vault fork) that
holds every credential our other containers need. At startup, each
container reads its secrets from a short-lived token mounted by a
sidecar. Secrets never appear in environment variables of long-running
processes, never in source code, and never in container images.

The only exception is one bootstrap credential (the secrets container's
own root token), stored as a GitHub Actions Secret and rotated by the
operator. Every other secret is derived from that one.

Things we do not do: storing API keys in `.env` files committed to the
repo; embedding keys in container images; passing secrets through
build-time environment variables.
-->

## Cookie policy

Every cookie we set, and the flags it carries.

{{COOKIE_POLICY}}

<!-- Example fill:
| Cookie | Purpose | Flags | Lifetime |
|---|---|---|---|
| `session_access` | Short-lived access token | `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` | 15 min |
| `session_refresh` | Long-lived refresh token | `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/auth/refresh` | 30 days |
| `csrf_token` | CSRF defense for non-GET routes | `Secure`, `SameSite=Strict`, `Path=/`, not HttpOnly (the frontend reads it to echo) | session |

A new `Set-Cookie` header that misses `HttpOnly`, `Secure`, or
`SameSite` is a finding. A refresh-token cookie with a broader scope
than `/auth/refresh` is a finding.
-->

## Untrusted-input boundaries

Where untrusted data enters the system, and where it gets validated.

{{INPUT_BOUNDARIES}}

<!-- Example fill:
Every API route has a request schema (we use Zod). The schema runs
before the route handler — handlers never see un-validated input. A
new route without a schema is a finding.

If our project sends user input into an AI model (a prompt, a search
query that becomes part of a prompt), it passes through `InputSanitizer.sanitize`
first. This blocks the common prompt-injection patterns. A new path
from user input to a model call that skips the sanitizer is a finding.
-->

## What we log, and where it goes

Logging boundaries: what we write where, and what must never appear in a place the user can read.

{{LOGGING_POLICY}}

<!-- Example fill:
**Server-side logs** (stdout, log files, log-aggregation pipeline)
can contain anything: full request bodies, tokens, internal error
messages. The server logs are not exposed to the browser.

**HTTP response bodies** must not echo internal error messages.
Returning `{ "error": err.message }` from a 500 handler is a finding.
The pattern we use: log the real error server-side with a request ID,
return a generic message plus the request ID to the browser, and look
the error up by ID in the logs when the user reports it.

**Browser console** must never receive tokens, full request bodies,
or credential headers. `console.log(authHeader)` is a finding, even
on a dev branch.

**Streaming endpoints** (Server-Sent Events, WebSockets) must not
forward server log output to the browser. A new SSE endpoint that
writes server logs into the stream is a finding.
-->

## What we don't defend against (yet)

Explicit list of risks this project has accepted, deferred, or decided are out of scope. The agents do not raise findings on these.

{{ACCEPTED_RISKS}}

<!-- Example fill:
- **Real-time abuse detection.** No bot-detection layer, no IP-based
  rate limiting beyond basic per-route. We accept the risk for now;
  revisit when we see real abuse traffic.
- **Per-field encryption at rest.** Disk-level encryption only; the
  database does not encrypt individual columns. Revisit when we hold
  data that requires it (payment cards, health records).
- **Browser fingerprinting.** Not implemented. We rely on the session
  cookie alone for "is this the same browser?" checks.
- **Audit log of every read.** We log writes; we do not log reads.
  Add when a customer contract requires it.
-->

## Decision docs that govern security choices

Every decision doc that has made an explicit security call. Index here, full text in `docs/decisions/`.

{{SECURITY_DECISIONS_INDEX}}

<!-- Example fill:
- `004-auth-gateway.md` — why the backend holds the session, not the
  browser.
- `005-secrets-via-vault.md` — why we run a dedicated secrets container.
- `037-fail-loud.md` — why critical-path errors propagate to the
  browser rather than being silently swallowed.
-->
