# Writing Style for Templates and Setup Docs

These rules apply to every file in `templates/`, `examples/`, the calibration blocks inside agent files, and the setup docs (`readme.md`, `ADAPTING.md`, `CALIBRATE.md`). They exist because the people setting this up are not all senior engineers — they may be solo developers, students, or technical founders who have not seen the jargon we throw around at work.

The agents themselves stay technical in the parts of their spec that only other agents read. The voice rules apply where humans set things up.

---

## 1. No codenames

Don't reference any specific app or company by name in templates or examples. The example shape **is** the architecture itself: a project with a frontend, a backend, an auth service, a datastore, and a few helper containers. Adopters mentally substitute their own names as they read.

- **Don't write:** "Evertales chose Keycloak..." (a real project name) or "Acme Tasks uses a login gateway..." (a made-up brand). Either kind of name shifts the doc from "this is your project" to "this is some other project."
- **Do write:** "Our backend runs an auth container that holds our identity provider. We chose Keycloak..." The "our" lets the reader mentally substitute their own setup as they read.

Pieces are called what they are by role: `frontend`, `backend`, `api container`, `auth service`, `auth container`, `datastore`, `middleware`, `worker`, `job runner`. The role name is the noun.

## 2. Plain English over acronyms

If a term has a plain-English equivalent, use the plain form. Spell out any acronym you can't avoid on its first use in a doc.

| Avoid | Prefer |
|---|---|
| BFF (backend-for-frontend) | "backend login gateway" or "backend auth gateway" |
| PKCE | "the modern OAuth login flow" |
| ADR | "decision doc" or "design decision" |
| CIAM | "user-login service" or "identity provider" |
| GHA | "GitHub Actions" |
| SPA | "frontend" or "single-page app" (once, then "frontend") |
| OSS | "open-source" |
| OWASP top 10 | "the OWASP list of common web vulnerabilities" (on first use) |
| KMS | "key management service" |
| CSP | "Content Security Policy" |
| SSE | "Server-Sent Events (a one-way streaming channel)" |
| TTL | "lifetime" or "expiry" |
| JWT | "signed token" (or `JWT` with brief gloss on first use) |
| RBAC | "role-based access control" |
| mTLS | "mutual TLS" with a one-sentence gloss on first use |

Don't stack acronyms. "OAuth/PKCE BFF flow" is unreadable. "OAuth login through the backend" carries the same meaning and a reader who has never heard of PKCE understands it.

These acronyms are unavoidable and stay as-is: **API, HTTP, JSON, CI, PR, LLM, OAuth, git, SQL, URL.** Anything else, prefer plain English or spell out on first use.

## 3. Slots use double braces; examples sit in HTML comments

Every fillable slot uses `{{SLOT_NAME_IN_CAPS}}`. Beneath each slot, an inline HTML comment shows what a real fill looks like, so the adopter sees the shape before they delete the example.

```markdown
## Hosting philosophy

{{HOSTING_PHILOSOPHY}}

<!-- Example fill:
Self-hosted open-source only. Managed user-login services (Auth0, Cognito,
Clerk) and managed databases are off the table. A pass-through edge service
like Cloudflare is fine; transactional email through a paid sender is the
one narrow exception.
-->
```

The adopter:

1. Reads the example.
2. Replaces `{{HOSTING_PHILOSOPHY}}` with their own version.
3. Deletes the comment when done.

## 4. Address the reader directly

Use "you" for the adopter, "we" / "our" inside the example fills (since the examples describe what a project decided). Avoid "the user" when you mean "the adopter setting this up."

- "Fill this in before running the audit agents." (to the reader)
- "We picked Keycloak because we wanted to keep all user data inside our own cluster." (inside an example fill)

## 5. Lead with the why

In template prose, every slot has a one-sentence lead-in explaining what the slot is for and why it matters. "Why we ask: ..." sentences are short, concrete, and tied to a specific agent or behavior the fill enables.

- "**Why we ask:** Alice (the security review agent) needs to know where your routes live so she can spot a new route that forgot to attach the auth middleware."

This is the difference between a template a reader fills in confidently and one they fill in by guessing.

## 6. Prefer colons and full stops over em-dashes; no emoji; no aphorisms

Em-dashes are a stylistic tic that compound in AI-written prose. The default rule: try a colon, a parenthesis, or a new sentence first. Reserve em-dashes for cases where the alternatives genuinely read worse (long parenthetical asides where parens would nest awkwardly, for instance).

No emoji or icons in templates or setup docs. No aphorism-shaped closers ("at the end of the day...", "the rest is just plumbing"). Those read as filler when a reader is trying to extract meaning.

## 7. No time estimates in documentation

No "takes ~15 minutes," no "1-2 hours total," no "Step 3 (5 min)," no "expect this to take a day." Documentation describes the steps; readers time their own work.

Estimates in docs are wrong roughly always. They're either condescending (the reader is faster) or misleading (the reader is slower), and they create false expectations either way. They also reveal the writer guessing about something they have no information about: every reader's pace, every reader's familiarity with the stack, every reader's context-switch overhead.

The rule extends to PR descriptions, commit messages, and agent specs. A PR description says what changed and why; it does not predict review time or runtime. An agent spec describes what the agent does and how; it does not say "stay under N minutes" (the workflow YAML's `timeout-minutes` is the real runtime budget).

The exception is literal facts that happen to be measured in time: a cron schedule, a token lifetime, a poll-interval config value. Those are operational parameters, not predictions of how long something will take.
