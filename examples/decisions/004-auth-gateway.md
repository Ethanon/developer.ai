# 004 — Backend acts as the login gateway

**Date:** 2026-04-20
**Status:** Implemented
**Affects:** `api/src/auth/*`, the `auth` container, the cookie helpers in `api/src/system/`, the frontend's sign-in screen.

---

## Problem

Our first cut at user sign-in lived inside the `api` container. We had our own `auth` service in code — password hashing, session tokens, password-reset emails, the lot. A design review identified three problems with this shape:

1. **Coupling.** Bundling identity into the API container blocks horizontal scaling. If we ever want to put the API behind a load balancer with several instances, sessions become tricky (every instance has to share session state).
2. **Hand-rolled identity is expensive to get right.** Password hashing, session minting, one-time email codes — all of these have a "battle-tested open-source" equivalent. Owning that code means we own its bugs.
3. **Federation is a years-long footgun.** "Sign in with Google" sounds simple. Implementing it in-house, plus Apple, plus customer SAML for the enterprise plan later, becomes a large surface area to keep correct.

This decision replaces that shape. It specifies: **a dedicated `auth` container runs our identity provider; the `api` container is a stateless gateway that holds the user's session on the browser's behalf.**

## Decision

### 1. The pieces

- **`auth` container** runs our identity provider (Keycloak today, swappable).
- **`api` container** is the only thing the browser talks to. It exchanges codes for tokens with `auth`, sets cookies on the browser, and verifies tokens on every protected request.
- **`datastore-sql` container** is the database both `api` and `auth` use. (`auth` uses it for its realm state; `api` uses it for user records and app data.)
- **`secrets` container** holds the credentials the `api` and `auth` containers need to talk to each other.

Notice the names: `auth`, `api`, `datastore-sql`. We do not name the containers after the technology inside them. The day we swap Keycloak for Authentik, no code, no doc, and no operator runbook has to rename anything.

### 2. The flow

```
1. The browser visits /auth/login on api.
2. api redirects to auth's sign-in page.
3. The user signs in (email/password, or "Sign in with Google").
4. auth redirects to /auth/callback on api with a one-time code.
5. api exchanges the code for two tokens with auth (server-to-server):
     - access token: short-lived signed token (15 minutes)
     - refresh token: long-lived opaque token (30 days)
6. api sets two cookies on the browser:
     - HttpOnly access cookie, scoped to /, 15 minutes
     - HttpOnly refresh cookie, scoped to /auth/refresh, 30 days
7. api looks up (or creates) the user record in datastore-sql,
   keyed by the subject claim from the access token.
8. Browser is redirected to the app home.

Subsequent requests:
   browser sends cookie → api verifies the access token signature
   → request reaches the route handler with userId attached.

Refresh:
   access token expires → next call returns 401 → frontend
   silently hits /auth/refresh → api exchanges the refresh token
   at auth for a new pair of tokens → updates cookies → frontend
   replays the original request.

Sign-out:
   browser hits /auth/logout → api tells auth to revoke the
   refresh token → api clears both cookies.
```

The browser **never holds a real token in JavaScript**. The only thing the browser has is two opaque cookies. JavaScript on the page cannot read them.

### 3. What stays inside the API container

A thin layer of code that:

- Forms the redirect URL to `auth`'s sign-in page.
- Exchanges codes for tokens with `auth`.
- Sets and clears cookies.
- Verifies the access-token signature on every request.

We do not write password hashing, session minting, one-time email code generation, account recovery flows, or login-attempt rate limiting. Those all live inside the `auth` container's config.

### 4. The verifier interface

```ts
interface SessionVerifier {
  verify(token: string): Promise<SessionClaims | null>
}

interface SessionClaims {
  userId: string
  tenantId: string
  sessionId: string
}
```

The verifier fetches public keys from `auth` once at startup, caches them for ten minutes, and refetches them transparently when a token with an unfamiliar key ID arrives. Token validation checks the signature, the issuer, the audience, the expiry, and the "issued at" timestamp.

The `SessionVerifier` interface knows nothing about Keycloak. The day we swap to Authentik or another provider, only the public-keys URL changes.

### 5. The broker interface

Everything the `api` container needs to ask the `auth` container goes through one wrapper:

```ts
interface AuthBroker {
  getSignInUrl(state: string, codeChallenge: string, redirectUri: string): string
  exchangeCode(code: string, codeVerifier: string, redirectUri: string): Promise<TokenSet>
  refreshTokens(refreshToken: string): Promise<TokenSet>
  endSession(refreshToken: string): Promise<void>
}
```

`KeycloakAuthBroker` is the implementation. If we ever swap providers, we write a second implementation and switch which one the container constructs at startup. None of the route handlers know which provider is in use.

### 6. Cookies

| Cookie | Lifetime | Flags |
|---|---|---|
| `session_access` | 15 minutes | `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` |
| `session_refresh` | 30 days | `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/auth/refresh` |

The refresh cookie's narrow path scope is important. Even if some future bug at `/api/*` accidentally echoes the access cookie into a log somewhere, the refresh cookie is never sent on those paths, so it cannot leak.

### 7. New user provisioning

The first time a user signs in, the `auth` container creates them in its realm and assigns a stable internal ID. The `api` container's callback handler then creates a matching row in `datastore-sql` (`userId` from `auth`'s claim, plus the user's tenant assignment).

We do this in the auth container's signup flow as a server-side plugin, not in the API container's callback handler. The reason: the API doing the user creation cannot be atomic with the auth container's own user creation. If the user closes the browser between those two writes, we end up with an account in `auth` and nothing in our database — a broken state that blocks the user from ever signing in again on the same email. The auth-container plugin runs inside the same transaction as the user creation, so a half-finished signup rolls back cleanly.

## What we considered and rejected

- **Custom in-process auth (where we started).** Rejected after design review. We do not want to own password hashing and email-code flows.
- **A managed identity provider (Auth0, Cognito, Clerk, WorkOS).** Rejected because we keep all user data inside our own cluster (`PROJECT_CONTEXT.md` "How we host it"). Managed identity also has per-user pricing that hurts at scale.
- **Tokens directly in the browser (frontend talks to `auth` over OAuth itself).** Rejected. The browser holding a real token is a big browser-attack surface for no real benefit — the backend still has to do everything anyway.
- **A library inside the API container that just wraps an identity provider's SDK.** Rejected. We want a hard process boundary between user identity and our business logic. The container line is the simplest place to draw it.

## Trade-offs we accept

- **One more container to operate.** The `auth` container has to be running for sign-in to work. We mitigate with the same health-check and restart policies we use for every other container.
- **The API is the single chokepoint.** If `api` goes down, the product is unavailable. We mitigate with redundant instances behind a load balancer; the API is stateless, so this is straightforward.
- **A redirect-based flow has a small browser-side cost** (full-page redirect on sign-in). The alternative is a popup or an iframe flow; we picked the redirect because it's simpler and works in every browser without exception.

## How we'll know if this was wrong

- More than 1% of requests fail the verify step (suggests token lifetime is too short, or the verifier is too strict).
- Sign-in latency above 800ms at p95 (the redirect round-trip is too expensive for our users).
- Operators report that `auth` is the most-failing container.

If we hit any of these, the right next step is usually a tuning change, not a redesign.

## Files affected

| File | Change |
|---|---|
| `api/src/auth/login.ts` | New — `/auth/login` route |
| `api/src/auth/callback.ts` | New — `/auth/callback` route |
| `api/src/auth/refresh.ts` | New — `/auth/refresh` route |
| `api/src/auth/logout.ts` | New — `/auth/logout` route |
| `api/src/middleware/requireSession.ts` | New — auth middleware |
| `api/src/system/SessionVerifier.ts` | New — verifier interface + Keycloak impl |
| `api/src/system/AuthBroker.ts` | New — broker interface + Keycloak impl |
| `api/src/auth/legacy/*` | Deleted (old in-process auth code) |
| `frontend/src/login/Form.tsx` | Deleted (Keycloak owns the sign-in UI) |
| Containers: `auth/`, `datastore-sql/`, `secrets/` | New container definitions |
