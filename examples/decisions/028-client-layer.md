# 028 — Outside-services client layer

**Date:** 2026-04-18
**Status:** Implemented
**Affects:** `api/src/system/clients/`, `api/src/system/adapters/`, every route or service that calls an outside provider.

---

## Problem

Our backend talks to a handful of outside services: an email provider, a search index, an analytics endpoint, and (soon) an AI model. The first cut at this had route handlers calling vendor SDKs directly:

```ts
import { Resend } from 'resend'
const resend = new Resend(env.RESEND_API_KEY)
await resend.emails.send({ to, subject, body })
```

This caused three problems that piled up over a few weeks:

1. **Vendor lock-in by accident.** Every route that sent an email imported the Resend SDK. Switching to Postmark meant editing every one of those files. We picked Resend casually; it became permanent because of the import graph.
2. **Test setup grew weeds.** Mocking the SDK in tests required matching its exact shape, including methods we didn't use. A new test had to know about Resend even if all it cared about was "an email got sent."
3. **No place for cross-cutting concerns.** Retry-on-429, logging, metrics, request IDs: every route that talked to a vendor re-implemented these or skipped them entirely.

This decision puts a thin layer between business logic and outside services so we control the shape of the interface, not the vendor.

## Decision

### Three layers

```
config         (what to talk to, where, with which credentials)
   ↓
adapters       (private: one class per vendor)
   ↓
clients        (public: one class per role — EmailClient, SearchClient, ...)
   ↓
consumers      (route handlers, services — depend only on clients)
```

### Layer 1: Config

A single file declares what exists, at what URL, with which credentials. The credentials are looked up from the `secrets` container at startup; this file only names them.

```ts
export const config: ServerConfig = {
  email:     { role: 'email',     adapter: 'postmark', baseUrl: 'https://api.postmarkapp.com' },
  search:    { role: 'search',    adapter: 'opensearch', baseUrl: 'http://datastore-search:9200' },
  analytics: { role: 'analytics', adapter: 'plausible', baseUrl: 'https://plausible.io/api/v1' },
}
```

One source of truth. No two-source-of-truth env-variable chains. Different deploy target → a sibling `config.prod.ts`, selected at build time.

### Layer 2: Adapters (private)

`api/src/system/adapters/`. Nothing outside this folder imports from here.

- `types.ts`: the interfaces every adapter implements (`EmailAdapter`, `SearchAdapter`, `AnalyticsAdapter`).
- `PostmarkAdapter.ts`: implements `EmailAdapter` by talking to Postmark's HTTP API.
- `OpenSearchAdapter.ts`: implements `SearchAdapter`.
- `PlausibleAdapter.ts`: implements `AnalyticsAdapter`.
- `build.ts`: three factory functions (`buildEmailAdapter`, `buildSearchAdapter`, `buildAnalyticsAdapter`) that switch on the `adapter` field in config and return the right instance.

Adding a new vendor = one new file in `adapters/` plus one case in the factory. Swapping a vendor = same.

### Layer 3: Clients (public)

`api/src/system/clients/`. Route handlers and services import only from here.

- `EmailClient.ts`: wraps an `EmailAdapter`, exposes a small role-shaped API (`.sendInvite(workspace, email)`, `.sendPasswordReset(email)`).
- `SearchClient.ts`: wraps a `SearchAdapter`, exposes `.indexTask(task)` and `.search(query, tenantId)`.
- `AnalyticsClient.ts`: wraps an `AnalyticsAdapter`, exposes `.track(eventName, props)`.
- `Clients.ts`: the `Clients` interface plus a `ClientRegistry` that reads config at startup and builds one instance of each.

Clients are where cross-cutting concerns go: retry-on-429, structured log lines, request IDs, metrics. A route handler calling `clients.email.sendInvite(...)` gets all of that for free.

### Layer 4: Consumers take `Clients`, not individual clients

Every service and route handler receives **one parameter**: `clients: Clients`. Inside, they reach for `clients.email.sendInvite(...)` or `clients.search.search(...)` as needed.

```ts
export class WorkspaceService {
  constructor(private readonly clients: Clients) {}

  async invite(workspaceId: string, email: string): Promise<void> {
    await this.clients.email.sendInvite(workspaceId, email)
    await this.clients.analytics.track('workspace_invite_sent', { workspaceId })
  }
}
```

Adding a new client (a translation service, an SMS sender, anything) means one new property on `Clients` and one new line in `ClientRegistry`. **Zero changes to consumer constructors.** That's the win.

## What we considered and rejected

- **Just import the SDK directly (where we started).** Rejected for the three reasons in the Problem section above.
- **A single God-Client (`OutsideClient`) with methods for everything.** Rejected. Nominal typing at the call site is worth real money: `clients.email.sendInvite(...)` cannot be confused with `clients.search.search(...)` at the type level. A single client gives up that safety.
- **Factory functions instead of classes.** Rejected because consumers carry the registry as a field; classes give us a clean lifecycle (startup wiring, optional shutdown hooks) without much ceremony.
- **Vendor-flavored clients (`PostmarkClient`).** Rejected because the public name should describe the role, not the vendor. A consumer asking for `clients.postmark` would have to be edited the day we swap.

## Trade-offs we accept

- **A thin wrapping layer adds nothing functionally.** Every `EmailClient` method is more or less a one-line forward to the adapter. We accept that. The shape pays off the first time we swap a vendor (small) and every time we add a new consumer (medium).
- **Consumers formally depend on the whole `Clients` bundle** even if they only use one client. We accept that: in practice the test setup just builds a tiny `Clients` with only the parts a given test exercises.
- **Adding a vendor still requires writing one adapter.** We could have used a generic HTTP client and configured it per-vendor; we rejected that because vendor SDKs each have their own quirks (auth header style, error shape, rate-limit signal). The adapter layer is where those quirks live; the client layer never sees them.

## How we'll know if this was wrong

- We never swap a vendor in the lifetime of the project. (If the layer never pays back, it was a premature abstraction.)
- The wrapper is constantly getting in the way: every new feature requires changes to both the adapter and the client. (Suggests the public client shape is wrong, not that the pattern is wrong.)

## Files affected

| File | Change |
|---|---|
| `api/src/config.ts` | New: declarative role to adapter mapping |
| `api/src/system/adapters/types.ts` | New: adapter interfaces |
| `api/src/system/adapters/PostmarkAdapter.ts` | New |
| `api/src/system/adapters/OpenSearchAdapter.ts` | New |
| `api/src/system/adapters/PlausibleAdapter.ts` | New |
| `api/src/system/adapters/build.ts` | New: factory |
| `api/src/system/clients/Clients.ts` | New: interface + registry |
| `api/src/system/clients/EmailClient.ts` | New |
| `api/src/system/clients/SearchClient.ts` | New |
| `api/src/system/clients/AnalyticsClient.ts` | New |
| `api/src/routes/**/*.ts` | Take `clients: Clients` |
| `api/src/services/**/*.ts` | Take `clients: Clients` |
| `api/src/__tests__/mocks.ts` | New `createMockClients()` helper |
