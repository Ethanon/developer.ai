# Security Model

<!--
Alice (the security review agent) and the security_audit bot read this
file as their source of truth, alongside engineering/SECURITY_PRINCIPLES.md.

The division of labour between the two:

  engineering/SECURITY_PRINCIPLES.md  the RULES. Portable, stack-neutral,
                                      the same for every project. Do not
                                      edit per-project.
  docs/SECURITY.md (this file)        YOUR ANSWERS. Which identity provider,
                                      which secrets store, what your threat
                                      model actually is, what you have
                                      accepted as out of scope.

The file ships pre-filled with opinionated defaults. The installer
adjusts them during setup based on your Q&A answers; you edit further
if your project's reality differs. Sections that only apply to certain
architectures carry a tag in HTML comments.

Sections marked TO FILL are the ones the defaults cannot guess for you.
-->

## Deployment context

<!-- TO FILL -->

Where this runs, who can reach it, and what the blast radius of a compromise is. Answer in a paragraph covering five things: hosting platform; network exposure (public internet, VPN, internal only); how many tenants share an instance; what data classes you hold (credentials, payment, health, personal, none of the above); and what stage you are at (pre-alpha, private beta, production with paying users). Every risk decision below is only defensible relative to this paragraph, and it changes as you grow.
<!-- tag: Generic -->

## Threat model

<!-- TO FILL -->

Who you are defending against, in priority order. Be specific enough to make trade-offs with. A useful default starting set:

| Adversary | Motivation | What they would try first |
|---|---|---|
| Opportunistic scanner | Automated, untargeted | Known CVEs in dependencies, default credentials, exposed admin routes |
| Curious authenticated user | Poking at boundaries | Changing an id in a URL, replaying a request against another tenant |
| Credential-stuffing bot | Account takeover at scale | Reused passwords against your login endpoint |
| Cost attacker | Burning your budget | Driving expensive operations (model calls, exports) on a stolen session |

Anything you are explicitly NOT defending against belongs in "What we don't defend against (yet)" near the bottom, not here.
<!-- tag: Generic -->

## Trust boundaries

**Trusted:**

- Our own services running inside our cluster, talking to each other over the internal network.
- Our `auth` service's signed tokens. We verify the signature on every request.
- Our `datastore` responses. We wrote what's in there.

**Untrusted:**

- The browser, and anything coming from it: headers, cookies, body, query params, URL path segments. Validated at the API edge before it reaches business logic.
- External APIs we call (email provider, analytics). Treat responses as untrusted input; never write them to the database without validation.
- Anything in a request that claims to identify the user (a `userId` in the body, a `tenantId` in a query param). We always derive identity from the session, never from the request.

<!-- tag: Generic -->

## How users sign in

Our backend runs an `auth` service that holds our identity provider (Keycloak today, swappable). The browser never sees a login token directly. The `api` service acts as a login gateway:

1. The browser hits `/auth/login` on the API.
2. The API redirects to the `auth` service's sign-in page.
3. The user enters their email and password (or clicks a third-party "Sign in with..." button); the `auth` service verifies them.
4. The `auth` service redirects back to `/auth/callback` on the API with a temporary code.
5. The API exchanges that code for a signed access token plus a long-lived refresh token (server-to-server with the `auth` service).
6. The API sets two cookies on the browser: an `HttpOnly` access-token cookie (15-minute lifetime) and an `HttpOnly` refresh-token cookie (30-day lifetime, scoped to `/auth/refresh`).
7. Subsequent requests carry the cookies. The API verifies the access token on every request and, when it expires, the frontend hits `/auth/refresh` to get a new pair.

The literature sometimes calls this shape the "backend-for-frontend" pattern. The reason to bother: the browser never holds a real token in JavaScript, which closes off a whole class of browser-side attacks.
<!-- tag: Architecture-Conditional; applies-when: has-frontend + has-auth -->

## How requests are authorized

Every route under `/api/*` runs through one middleware (`requireSession`) that:

1. Reads the access-token cookie.
2. Verifies the signature against the auth service's public keys.
3. Looks up the user record in our database (one indexed read).
4. Attaches `userId` plus `tenantId` plus `roles` to the request context.

Routes derive identity from the context, never from the request body. A route that reads `tenantId` from the body is a finding.

For multi-tenant data, every database query is scoped by `tenantId` from the context. We use a small helper (`scoped(tenantId).from('records')`) that no route is allowed to bypass.
<!-- tag: Architecture-Conditional; applies-when: has-backend + has-auth -->

## How we store secrets

We run a `secrets` service (OpenBao, the open-source Vault fork) that holds every credential our other services need. At startup, each service reads its secrets from a short-lived token mounted by a sidecar. Secrets never appear in environment variables of long-running processes, never in source code, and never in container images.

The only exception is one bootstrap credential (the secrets service's own root token), stored as a GitHub Actions Secret and rotated by the operator. Every other secret is derived from that one.

Things we do not do: storing API keys in `.env` files committed to the repo; embedding keys in container images; passing secrets through build-time environment variables.
<!-- tag: Personal Preference; default-on -->
<!-- override: if your project uses a different secrets store (HashiCorp Vault, AWS Secrets Manager, a sealed-secrets ConfigMap), replace this paragraph with what you actually use. -->

## Cookie policy

| Cookie | Purpose | Flags | Lifetime |
|---|---|---|---|
| `session_access` | Short-lived access token | `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` | 15 min |
| `session_refresh` | Long-lived refresh token | `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/auth/refresh` | 30 days |
| `csrf_token` | CSRF defense for non-GET routes | `Secure`, `SameSite=Strict`, `Path=/`, not `HttpOnly` (the frontend reads it to echo) | session |

A new `Set-Cookie` header that misses `HttpOnly`, `Secure`, or `SameSite` is a finding. A refresh-token cookie with a broader scope than `/auth/refresh` is a finding.
<!-- tag: Architecture-Conditional; applies-when: auth-via-cookies -->

## Untrusted-input boundaries

Every API route has a request schema (we use Zod). The schema runs before the route handler; handlers never see un-validated input. A new route without a schema is a finding.

If our project sends user input into an AI model (a prompt, a search query that becomes part of a prompt), it passes through `InputSanitizer.sanitize` first. This blocks the common prompt-injection patterns. A new path from user input to a model call that skips the sanitizer is a finding.
<!-- tag: Generic -->

## What we log, and where it goes

**Server-side logs** (stdout, log files, log-aggregation pipeline) can contain anything: full request bodies, tokens, internal error messages. The server logs are not exposed to the browser.

**HTTP response bodies** must not echo internal error messages. Returning `{ "error": err.message }` from a 500 handler is a finding. The pattern we use: log the real error server-side with a request ID, return a generic message plus the request ID to the browser, and look the error up by ID in the logs when the user reports it.

**Browser console** must never receive tokens, full request bodies, or credential headers. `console.log(authHeader)` is a finding, even on a dev branch.
<!-- tag: Architecture-Conditional; applies-when: has-frontend -->

**Streaming endpoints** (Server-Sent Events, WebSockets) must not forward server log output to the browser. A new SSE endpoint that writes server logs into the stream is a finding.
<!-- tag: Generic -->

## Transport

<!-- TO FILL -->

What protects each hop. Fill in per boundary from the trust-boundary table:

| Hop | Protection | Notes |
|---|---|---|
| Client to edge | TLS 1.3, HSTS | Minimum version, cert source, HSTS max-age |
| Edge to application | | Which proxy headers you trust, and why that is safe |
| Application to internal services | | mTLS, network policy, or neither (say so) |
| Egress to third parties | | Which external hosts you call, and whether egress is restricted |

<!-- tag: Generic -->

## Rate limiting

<!-- TO FILL -->

Per [`engineering/SECURITY_PRINCIPLES.md`](../engineering/SECURITY_PRINCIPLES.md) the structure is three layers with distinct goals. Record what each layer is set to here, since the numbers tune as you learn:

| Layer | Goal | Current setting |
|---|---|---|
| Edge, per IP | Shed abusive traffic | |
| Auth endpoints, per IP and per account | Defeat credential stuffing | |
| Per-tenant budget on expensive operations | Cap the damage of a stolen session | |

<!-- tag: Generic -->

## Audit logging

<!-- TO FILL -->

Which events go to the audit stream, where that stream lives, how long it is retained, and what the field allowlist is. If you have not built one yet, say so explicitly and put it on the roadmap below rather than leaving this section blank.
<!-- tag: Generic -->

## Named exceptions

Deliberate deviations from [`engineering/SECURITY_PRINCIPLES.md`](../engineering/SECURITY_PRINCIPLES.md), each with its reasoning. These exist so the next reader and your scanners can tell an intentional decision from an oversight.

| Deviation | Why it is safe | What would make it unsafe |
|---|---|---|
| _example:_ `GET /auth/recover` mutates state | Recovery links are single-use and expire in 15 minutes; the mutation is idempotent | If the link became reusable, or the endpoint gained side effects beyond marking recovery started |

> Add a row whenever you knowingly break a rule. An undocumented exception gets "fixed" by someone who does not know why it exists, or waved through the next time it is a real bug.
<!-- tag: Generic -->

## Tooling and audit cadence

**Every commit:** security lint plugin, strict type checking, dependency audit in CI. High and critical findings block merge until triaged; documented exceptions live in one allowlist file with expiry dates.

**Weekly:** the `security_audit` agent scans the repo against this document plus `engineering/SECURITY_PRINCIPLES.md` and writes a timestamped report to `.claude/reports/`. It does not modify code.

**Every PR:** `alice_security` reviews the diff.

**Per release, or quarterly:** human-led review. Which boundaries did new features cross, what control protects each crossing, what changed in the threat model, which assumption here is no longer true.
<!-- tag: Generic -->

## Implementation roadmap

<!-- TO FILL -->

Controls this document describes that are not built yet, in the order you intend to build them. Being honest here is what keeps the rest of the document trustworthy: a doc that describes controls as though they exist, when they do not, is worse than no doc.

| Control | Status | Target |
|---|---|---|
| _example:_ per-service identity on internal calls | Not started | Before first external users |

<!-- tag: Generic -->

## What we don't defend against (yet)

Risks we've accepted, deferred, or decided are out of scope. The agents do not raise findings on these.

- **Real-time abuse detection.** No bot-detection layer, no IP-based rate limiting beyond basic per-route. We accept the risk for now; revisit when we see real abuse traffic.
- **Per-field encryption at rest.** Disk-level encryption only; the database does not encrypt individual columns. Revisit when we hold data that requires it (payment cards, health records).
- **Browser fingerprinting.** Not implemented. We rely on the session cookie alone for "is this the same browser?" checks.
- **Audit log of every read.** We log writes; we do not log reads. Add when a customer contract requires it.

<!-- tag: Personal Preference; default-on -->
<!-- override: edit this list to match your project's accepted risks. Anything not on this list, the agents are free to flag. -->

## Decision docs that govern security choices

| Decision doc | What it settles |
|---|---|
| `examples/decisions/004-auth-gateway.md` | Why the backend holds the session, not the browser |
| `examples/decisions/037-fail-loud.md` | Why critical-path errors propagate to the browser rather than being silently swallowed |

> Add your own security decisions here as you write them. The agents read this table to know what's been settled and shouldn't be re-litigated on every PR.
