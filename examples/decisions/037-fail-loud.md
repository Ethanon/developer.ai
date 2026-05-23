# 037 — Fail loud on critical paths

**Date:** 2026-04-19
**Status:** Implemented
**Affects:** Removes silent `try/catch`, `.catch()`, and early-return swallows across the backend's critical path. After this change, every backend failure on the user's critical path throws up to the route handler, which catches once, logs, and returns `500`. The frontend's existing error UX (revert the optimistic update, show "try again", let the user retry) takes over from there. No fabricated data anywhere in the backend.

---

## Problem

Our engineering principles say: *critical-path operations must fail loudly.* An audit found ten places that violated it:

- Seven `try/catch` blocks that swallowed errors and returned empty results, default guesses, or fabricated stand-in data.
- Two chained `.catch()` handlers doing the same.
- One silent early return that fabricated a result string and returned an empty payload, never throwing.

The worst was the workspace-creation handler's outer catch. If anything threw upstream — a database timeout, an email-send failure, a malformed user record — the handler returned a fabricated `{ workspace: { id: 'pending', name: 'New workspace' } }` to the frontend, as if the creation had succeeded. The frontend would happily display the fake workspace until the user refreshed the page and noticed it was gone.

The pattern was always well-intentioned: "don't show a 500 to the user, give them something to look at." The result was uniformly bad: it papered over real bugs, made debugging much harder, and confused users in ways a clear error never would have.

## Decision

**Delete every silent catch on the critical path. Let errors throw.**

The Hono route handlers in `api/src/routes/*.ts` already wrap service calls in a `try/catch` that logs once and returns `500 { error: 'Action failed' }`. That is exactly the right place — one catch at the boundary, not a `try/catch` at every layer. The frontend's existing error handling (revert the optimistic update plus a friendly retry button) takes it from there.

Two exceptions, both **explicit** and both adding nothing semantic:

- `EmailService.sendInvite` — wraps the call to the email client in `try { ... } catch (err) { Logger.error('email/invite', err); throw err }`. A specific log tag adds diagnostic value at this boundary; the re-throw is pass-through.
- `WorkspaceService.create` — same pattern around the database write. Workspace creation is user-visible enough that we want an obvious entry in the log when it fails.

Neither returns a fallback. Neither suppresses the error. Both just add a named log point before re-throwing.

**No lint rule.** Silent-catch detection is a semantic judgment — sometimes a catch genuinely is the right call (advisory or background work; see below). A lint rule would produce too many false positives. Code review plus this decision doc is the enforcement.

## What we considered and rejected

- **"Soft fail with a generic stand-in."** This is what we were doing. Rejected because it papers over real bugs and confuses users worse than a clean error.
- **A `Result<T, E>` envelope at every layer.** Rejected. The route-level catch is the right boundary; wrapping every service method in a `Result` envelope re-invents the `try/catch` we are removing, just with more types.
- **Different error UX per route.** Rejected. The frontend already handles 500s well (the optimistic-update pattern). Adding per-route error shapes is more work for no user benefit.

## What stays silent — and why

Two categories of failure are legitimately advisory:

**Background writes that follow the user's request.** A request that creates a workspace also writes an analytics event. The analytics write happens after the response has been sent. If it fails, we log and move on — the user's request already succeeded, and a missing analytics event is not user-visible.

```ts
this.analytics.track('workspace_created', { ... }).catch(err => {
  Logger.warn('analytics/workspace_created', err)
})
```

**Background-job handlers.** Per-item failures inside a batch job (e.g., one of fifty invite emails fails) log-and-continue. The job overall finishes; the user sees the items that succeeded and can retry the one that didn't.

These are explicitly advisory and explicitly documented. A new advisory catch should have a one-line comment naming why it's advisory.

## How we'll know if this was wrong

- 500 rates climb to the point where users notice. (Suggests the real failures we are now surfacing are too common — fix the underlying causes, don't go back to swallowing.)
- The frontend's retry UX stops working in some flow. (Suggests we missed a flow when removing the catches; add it back, but loudly, not silently.)

Neither of these is a reason to put the catches back. The fail-loud rule is about *where* the boundary lives, not whether one exists.

## Test updates

Three tests codified the old fabricate-and-continue behavior. They were updated to assert the error now propagates:

- `WorkspaceService.test.ts` — `returns fallback workspace when db fails` → `throws when db fails`
- `WorkspaceService.test.ts` — `creates anyway when email fails` → `throws when email fails`
- `InviteService.test.ts` — `returns success when email is unavailable` → `throws when email is unavailable`

Each asserts `await expect(service.method(...)).rejects.toThrow(...)`. The route-level `try/catch → 500` flow does the rest.

## Non-goals

- Not introducing `Result<T, E>` at these layers.
- Not changing the frontend. The frontend already handles 500s correctly.
- Not touching background jobs or analytics writes. Their log-and-continue is the correct pattern for advisory work.

## Files affected

| File | Change |
|---|---|
| `api/src/services/WorkspaceService.ts` | Removed silent catch; added named log-and-throw |
| `api/src/services/EmailService.ts` | Removed silent catch; added named log-and-throw |
| `api/src/services/InviteService.ts` | Removed three silent catches |
| `api/src/routes/workspaces.ts` | Removed early-return fabrication path |
| `api/src/__tests__/WorkspaceService.test.ts` | Updated three tests |
| `api/src/__tests__/InviteService.test.ts` | Updated one test |
