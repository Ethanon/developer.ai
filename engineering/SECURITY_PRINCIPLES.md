# Security Principles

<!--
`alice_security` (PR review) and `security_audit` (weekly scan) both read this
file as a source of truth. Each section carries a tag in an HTML comment near
its body:

  tag: Generic
  tag: Architecture-Conditional; applies-when: <condition>

The installer reads these tags and tailors a copy of this file to the adopter's
project at install time. If you're reading the kit verbatim, all defaults are on.

This file holds the RULES, which are portable across projects. Your project's
own answers (which identity provider, which secrets manager, what your threat
model actually is) go in `docs/SECURITY.md`, built from
`templates/SECURITY.md`.
-->

## How to use this document

Rules here are stated stack-neutrally, with one concrete example where a rule is
hard to picture without it. Wherever you see a named product, it is an
illustration, not a requirement.

**Examples are written for an HTTP service, because that is the most common
shape. The rules are not about HTTP.** They are about a trust boundary with an
untrusted caller on the far side of it, and they apply wherever that boundary
exists: a desktop or mobile client talking to a backend, an RPC service, a queue
whose producers you do not control, an IPC surface, a public library API called
by code you did not write. Read "route" as "the place an outside request first
reaches your code," and every section below transfers unchanged. Where a rule
genuinely does depend on the transport, it carries a tag saying so.

Every rule exists because it closes a specific failure. Where the failure is
non-obvious, the rule says what goes wrong. A rule you cannot satisfy is not a
rule to quietly skip: write the exception down (see "Named Exceptions").

---

## Trust Boundaries

**The question, asked of every new feature:** _which boundaries does this cross, and what control protects it at each crossing?_
<!-- tag: Generic -->

Five boundaries cover most application shapes. Every control in this document lives at one of them.

| # | Boundary | Threats | Primary controls |
|---|---|---|---|
| 1 | Client to edge | Eavesdropping, MITM, session hijack | TLS, HSTS, secure cookies |
| 2 | Edge to application | Internal eavesdropping, header spoofing | TLS, trusted proxy headers, rate limiting at the edge |
| 3 | Application trust core | Cross-tenant access, injection, broken auth | Session middleware, identity binding, schema validation, audit logging |
| 4 | Application to internal services | Lateral movement after one component is compromised | Network policy, per-service identity, no shared secret pools |
| 5 | Data at rest | Disk theft, backup leak, operator error | Per-tenant layout, encryption at rest, no sensitive values in filenames |

Draw the equivalent diagram for your own system in `docs/SECURITY.md` and keep it current. A feature whose author cannot say which boundaries it crosses has not been designed yet.

---

## Identity Binding

**The rule:** the tenant, account, or user id comes from the session. Never from a path, body, query, or header field.
<!-- tag: Generic -->

If you find yourself reaching for a request-supplied identifier to decide what data to return, the answer is no: go through middleware. A route that accepts `tenantId` from its path and trusts it is a cross-tenant read waiting for someone to change the number.

- Every route uses the auth and identity-binding middleware unless it is documented as deliberately unauthenticated (login, register, health).
- The middleware resolves identity once and puts it where handlers read it. Handlers never re-derive it.
- A request whose supplied identifier does not match the session's allowed set is rejected and audit-logged. That rejection is a signal worth alerting on, because it is what enumeration looks like.

---

## Input Validation

**The rule:** every entry point that accepts user-controlled input validates it against a schema before reading any field.
<!-- tag: Generic -->

"Entry point" is whatever your application shape actually has: an HTTP route handler, a queue or event consumer, a CLI argument parser, an IPC handler, a file or upload ingestion path, a public library function called by code you do not control. If input crosses from outside your trust boundary to inside it, that crossing is where validation happens.

Pick one validator and apply it uniformly (a schema library such as Zod or Pydantic). Uniformity is the point; the specific library is not. Three classes of validation, all required:

- **Shape.** The payload has the expected fields with the expected types. Missing or unexpected fields are rejected at the boundary, not handled in the handler.
- **Size.** Strings have explicit maximum lengths. Arrays have explicit maximum counts. The limits live in a single shared constants file so they can be audited in one place, per "No New Config or Env Files" in [`ENGINEERING_PRINCIPLES.md`](ENGINEERING_PRINCIPLES.md).
- **Semantics.** Identifiers match their expected format. Enums match the allowed value set. Free-form text bound for a model prompt passes the sanitizer described below.

### Validation lives in the application server, not the edge

The edge can enforce request size and request rate. It cannot enforce field-level semantics, because it does not know your data model. **Do not push security decisions onto infrastructure that does not own the application's data model.** An edge rule that "handles validation" is a rule that silently stops applying the moment someone reaches the application by another path.

---

## The Prompt-Injection Boundary
<!-- tag: Architecture-Conditional; applies-when: ships-llm-prompts -->

**The rule:** user-controlled text that will reach a model prompt is sanitized at the boundary where it first enters the system, not at the point where the prompt is assembled.

Two distinct controls, both needed:

- **Instruction-override stripping.** Free-form text destined for a prompt passes through a sanitizer that strips role-override and instruction-override patterns before it is stored or forwarded.
- **Structural-symbol gating on short identifiers.** User-typed display names (a character name, a workspace name, a project title) are validated at the creation boundary against control characters, newlines, and the structural symbols that can forge prompt sections: `=`, `<`, `>`, `|`, `{`, `}`, `[`, `]`.

The second control is the one teams skip, and it is the one that bites. If a display name can contain a newline and a `=` run, it can close your prompt's current section and open a new one that looks like system instruction. Gate it at creation so the hostile value never reaches durable storage, rather than escaping it at every one of the several places the name is later interpolated. One validation rule, shared by the input form and the server-side schema, is the shape to aim for.

Treat model output that will be fed back into another prompt as untrusted input too. It is user-influenced by construction.

---

## Client-Originated Mutations Are an Explicit Allowlist

**The rule:** the write route accepts a discriminated union over exactly the operation types a client legitimately originates. Every other state mutation is server-derived.
<!-- tag: Generic -->

A permissive write schema is an integrity bypass. If the route accepts an operation shape loosely and passes it to a generic applier, a client can persist any field the applier can reach: a balance, a role, a quota, an entitlement.

- Enumerate the operations the client actually originates. In most systems this is a short list.
- Make the route's schema a closed union over exactly those. Everything else is rejected at the boundary with a 400, not filtered later.
- Every other mutation is derived on the server from an intent the client expressed, never accepted from a client payload.

The test: _if a client sent an operation naming a field it should never control, where would that request stop?_ If the answer is "in the applier, probably", the schema is too loose.

---

## Output Escaping

**The rule:** any string that came from a user and is rendered back to a user goes through the framework's default escaping.
<!-- tag: Generic -->

No raw-HTML injection APIs for text that traces back to user input. Model-generated text is rendered the same way: it is user-influenced, and a model can be talked into emitting markup.

---

## Secrets

**The rule:** secrets are read through one wrapper, from a secrets store, on the same code path in every environment.
<!-- tag: Generic -->

- **One wrapper, one code path.** Development and production read secrets the same way. The only thing that varies is where the store lives. Code that reads a secret differently in development is code whose production path is untested.
- **Self-provisioning where it fits.** A `getOrCreate(path, generator)` primitive makes missing-at-startup impossible by construction: first boot against an empty store runs the generator and writes the value, later boots read it, and concurrent first-boot callers race safely because the loser re-reads the winner. Services then never need a "missing secret" error path, because that state cannot occur.
- **Workload identity over shared tokens.** Components authenticate to the secrets store as themselves (a projected service-account token, an instance role) rather than through a shared credential distributed to every component. A shared pool means one compromised component reads every secret.
- **No credential-shaped defaults in source.** Config files, compose files, and `.env.example` carry no secret values. If it looks like a secret, it comes from the store.
- **Rotation is an operations action, not a code change.** Secret paths are stable; values change. Keep prior versions for grace-period rollback where the store supports it.

---

## Logging

**The rule:** default-deny on what gets logged, in three tiers.
<!-- tag: Generic -->

**Never logged, at any level, in any environment:**

- Auth route request or response bodies. They carry credentials, authorization codes, and refresh tokens.
- Values of any field named in the redaction allowlist (`password`, `token`, `apiKey`, `cookie`, `authorization`, and whatever else your domain adds).
- Stack traces or framework internals in responses returned to a client. The stack lives in your server logs; the client gets a generic code.

**Allowed at debug level only, in non-production environments:**

- Whole request and response bodies for non-auth routes. Three constraints apply even here: redaction runs before serialization; the body is withheld entirely when the request was unauthenticated; and any streaming capture is size-capped so a long response cannot drive unbounded memory growth.

**Production:**

- Debug is gated off at the logger boundary, not at the call sites. The call sites still run; their output never reaches a sink.

### Redaction is a field-name allowlist applied before serialization

Not a regex sweep over an already-built string. Logging code that wants to include a sensitive field passes it as a structured field that the logger replaces with `[redacted]` before the record is serialized. A post-hoc scrub misses the value that got concatenated into a message two frames earlier.

---

## Audit Logging

**The rule:** audit events are a separate stream from diagnostic logs.
<!-- tag: Generic -->

What belongs in it:

- Successful login, failed login, credential change, token revocation, account lockout.
- Identity-binding rejections (a request whose supplied identifier did not match the session's allowed set).
- Inter-service identity rejections.
- Any 5xx that involved persisted state, so it can be correlated with a user report.

How it differs from diagnostic logging: append-only, retained longer, and restricted to an explicit field allowlist. Store client IP addresses hashed with a per-environment salt, so a stolen audit log cannot be cross-referenced against other breaches.

---

## Rate Limiting and Abuse

**The rule:** three layers, each with a different goal. One layer is not a rate-limiting strategy.
<!-- tag: Generic -->

- **Edge, per IP.** Goal: shed obviously abusive traffic before it reaches the application.
- **Auth endpoints, per IP and per account, with exponential backoff.** Goal: defeat credential stuffing and account-creation bots. Per-IP alone does not stop a distributed attempt against one account; per-account alone does not stop one source spraying many accounts.
- **Per-tenant budget on expensive operations.** Goal: a single account with a stolen session cannot drain the compute budget before anyone notices. For projects that call models, this is a daily cap on model invocations per tenant.
  <!-- tag: Architecture-Conditional; applies-when: ships-llm-prompts -->

Keep the actual numbers out of this document and in your configuration. They tune as you learn; the three-layer structure does not.

---

## Sessions and Cookies

**The rule:** every cookie carries the full attribute set. Tokens live in memory, refresh lives in an `HttpOnly` cookie.
<!-- tag: Architecture-Conditional; applies-when: has-frontend -->

- Cookies are `HttpOnly`, `Secure`, and `SameSite`-constrained. A cookie missing any of the three is a finding.
- Access tokens are held in memory, never in `localStorage` or `sessionStorage`, which any injected script can read.
- Refresh tokens live in an `HttpOnly` cookie set by the backend, so client JavaScript cannot exfiltrate them.

---

## Dev and Preview Harnesses

**The rule:** a code path that bypasses authentication must be both build-gated and dynamically imported.
<!-- tag: Architecture-Conditional; applies-when: has-frontend -->

This is the subtlest rule in this document and the one most likely to ship a real hole.

A dev harness (any path that bypasses the auth gate, or stubs the auth context, active-tenant, or data service) needs two independent controls:

1. **Gated by a build-time define that is `false` in normal production builds.**
2. **Reached only through a dynamic `import()` inside that `false` branch.**

Both, not either. A static top-level `import { Harness } from './devHarness'` ships the stub auth context to every user even when the render branch is correctly gated, because the bundler has already pulled the module into the graph. The dynamic import inside the dead branch is what lets the bundler tree-shake the module out of builds where the flag is unset.

The render gate protects behavior. The dynamic import protects the bundle. You need both.

---

## Named Exceptions

**The rule:** a deliberate deviation is written down as a numbered decision doc, with its reasoning, and linked from your security doc.
<!-- tag: Generic -->

Some deviations are correct. A `GET` that mutates state during account recovery, an endpoint that decodes a token without verifying it because a later layer verifies it, a route deliberately left unauthenticated. Each of these is defensible and each looks exactly like a bug to the next reader and to your scanners.

Write the exception down where it will be found: what the deviation is, why it is safe, and what would make it unsafe. An undocumented exception is indistinguishable from an oversight, and it will be either "fixed" by someone who does not know why it exists or waved through the next time it appears as a genuine bug.

---

## Static Checks and Audit Cadence

**Every commit:**
<!-- tag: Generic -->

- A security lint plugin, enabled, with intentionally-disabled rules documented inline at the point of disabling.
- Strict type checking. It catches the structural class of bug that ends in "we passed `undefined` where we meant the user's id".
- A dependency audit in CI on every PR. High and critical findings block merge until triaged. Documented exceptions live in a single allowlist file, each with an expiry date.

**Weekly:** the `security_audit` agent, a read-only scanner that uses this document plus your `docs/SECURITY.md` as its source of truth and writes a timestamped report. It does not modify code; a human triages each finding.

**Per release, or quarterly, whichever comes first:** a human-led review against this document. The questions are always the same. Which boundaries did new features cross? What control protects each crossing? What changed in the threat model? Which assumption in this document is no longer true?

---

## The Rules, In One Place

For a feature author. If a change touches any of these, it gets a security review.
<!-- tag: Generic -->

1. **A new entry point exists** (an HTTP route, a queue consumer, a CLI command, a public library function). It goes through the auth and identity-binding path, unless documented as deliberately unauthenticated.
2. **A new field accepts user input.** It is in that entry point's schema with shape, size, and semantic constraints.
3. **A new persisted record holds user text.** It renders through default escaping, never a raw-HTML API.
4. **A new log call includes a value derived from user input.** It uses the redaction wrapper for any allowlisted field name.
5. **A new inter-service call exists.** It carries per-service identity.
6. **A new secret exists.** It is read from the secrets store, not committed, and named in your deployment platform's secrets manager.
7. **A new cookie is set.** It is `HttpOnly`, `Secure`, and `SameSite`-constrained.
8. **A new source of tenant or account identity exists.** It is the session-bound identity, not a path, body, or query field.
9. **A new dev or preview harness exists.** It is build-gated AND dynamically imported, per "Dev and Preview Harnesses".
10. **A new user-controlled string reaches a model prompt.** It passes the sanitizer, and short identifiers are gated against structural symbols at the creation boundary.
    <!-- tag: Architecture-Conditional; applies-when: ships-llm-prompts -->

If you cannot satisfy one of these and the feature is genuinely necessary, write the exception as a numbered decision document and link it from your security doc.

---

## References

| Document | What it covers |
|---|---|
| [`ENGINEERING_PRINCIPLES.md`](ENGINEERING_PRINCIPLES.md) | Failure policy, no-new-config rule, decision-doc structure |
| [`../templates/SECURITY.md`](../templates/SECURITY.md) | The security doc your project fills in, with your stack's answers |
| [`../agents/pr-review/alice_security.md`](../agents/pr-review/alice_security.md) | The PR-review agent that enforces these rules on every diff |
| [`../agents/audits/security_audit.md`](../agents/audits/security_audit.md) | The weekly scanner that audits the repo against this document |
