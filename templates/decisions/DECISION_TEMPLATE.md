# NNN — Short Title

<!--
Section guidance lives in HTML comments throughout this file. Each comment
explains what belongs in the section beneath it. Read them once, then
delete each comment as you fill in its section.

Naming:
- File: NNN-kebab-case-title.md (e.g. 004-auth-gateway.md). NNN is the
  next free number in your decisions/ folder.
- Title: imperative or noun phrase. "Auth gateway, not direct token to
  browser." "Use Keycloak for sign-in." "Move scheduled bots to GitHub
  Actions." Avoid headlines like "Authentication system v2."

When to write one of these:
- A choice that closes a real option (we picked X, considered Y, here's
  why). If there was no real alternative, you don't need a decision doc.
- A choice that future readers (humans or AI agents) will want to
  understand without re-running the whole conversation that produced it.
- A choice big enough that "see commit history" is not a satisfying
  answer six months later.

What NOT to write decision docs for:
- Implementation details ("we used a Map instead of an Object"). The
  code shows that.
- Personal preferences ("I like tabs"). Those go in style guides.
- Reversible choices made for a single sprint ("we're hardcoding the
  email list until next week"). Use a TODO.

Length:
- 1 page is normal. 2-3 pages is fine for a choice with several real
  alternatives. Past 3 pages, the decision is probably actually
  three smaller decisions.
-->

**Date:** YYYY-MM-DD
**Status:** Proposed | Approved | Implemented | Superseded by NNN
**Affects:** brief list of files / containers / docs touched

<!--
Status values:
- Proposed: written but not implemented. Open for pushback.
- Approved: agreed but not landed in code yet.
- Implemented: in master. Most decisions sit here.
- Superseded by NNN: another decision doc replaces this one. Don't
  delete the file; move it to docs/decisions/historical/ and update
  this status line.

"Affects" is a hint for the next reader, not an exhaustive list. One
line. Examples:
- "Affects: api/src/auth/*, the secrets container's bootstrap."
- "Affects: every container's startup script."
- "Affects: .github/workflows/*.yml, one new repo secret."
-->

---

## Problem

<!--
What we're trying to solve, in 1-3 short paragraphs. Be concrete.

A reader who has never seen this codebase should understand WHY this
choice came up after reading this section. If the problem is just "we
needed to pick a library," there's probably no decision worth recording.

Things to include:
- The pain point that surfaced the decision (a bug, a scaling
  question, a vendor leaving free-tier, a security audit finding).
- What forced our hand right now, vs putting it off.
- The constraints that ruled out the obvious answer.

Things to leave out:
- A detailed history of how we got here. Two sentences max for context.
- "Pros and cons" lists. Those belong further down.
-->

## Decision

<!--
What we're doing. One sentence ideally, two if you need a comma.

Then, if useful, a paragraph or two unpacking it. Diagrams (ASCII or
linked images) belong here when they clarify shape. Code samples belong
here when they show the interface we're committing to.

If the decision has multiple parts, number them. Each part should be
defensible on its own — if a reader disagrees with part 3, parts 1 and
2 should still be useful.
-->

## What we considered and rejected

<!--
The real alternatives, with one or two sentences each on why we passed.

This section is what makes a decision doc valuable years later. The
"why we didn't" notes save the next person from re-running the same
analysis. If you can't think of two real alternatives, the decision
probably wasn't a real decision and this doc isn't needed.

Format:
- **Alternative A.** What it was. Why we passed.
- **Alternative B.** Same.

If an alternative is "we considered staying with what we had,"
include it. "Do nothing" is often the right call and the doc should
say so when it isn't.
-->

## Trade-offs we accept

<!--
What this decision costs. Every real decision costs something; if you
can't name the cost, you're probably writing a marketing brief.

Examples:
- "We accept that running our own auth container costs one more
  process to operate, in exchange for keeping user data inside our
  cluster."
- "We accept that the API container becomes the single chokepoint;
  if it goes down, the whole product is unavailable. We mitigate
  with redundant instances behind a load balancer."

If the trade-off is large enough to revisit later, name the trigger
that would make us revisit ("when we have multi-region customers").
-->

## How we'll know if this was wrong

<!--
Optional, but very useful when present. A short list of signals that
would tell us to revisit the decision.

Examples:
- "We see more than 1% of requests failing the auth-token verify
  step (suggests our verification is too strict or our token
  lifetime is too short)."
- "Operators report that running the secrets container is more
  pain than we expected."

This section lets future-you know whether the decision is still
serving you, instead of carrying it forward forever out of inertia.
-->

## Files affected

<!--
A short table or bulleted list of what's new, changed, or deleted as
part of this decision landing.

Example:
| File | Change |
|---|---|
| `api/src/auth/login.ts` | New |
| `api/src/middleware/session.ts` | Replaces old `legacy-auth.ts` |
| `frontend/src/login/Form.tsx` | Deleted (Keycloak owns the UI now) |

Keep it short. The git diff is the authoritative record; this list
just helps a reader spot the shape at a glance.
-->
