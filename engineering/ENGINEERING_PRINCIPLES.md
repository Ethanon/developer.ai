# Engineering Principles

<!--
Every reviewer agent (Alice, Bob, Phil, Gomez) reads this file as a source of
truth. Each section carries a tag in an HTML comment near its body:

  tag: Generic
  tag: Architecture-Conditional; applies-when: <condition>
  tag: Personal Preference; default-on  (or default-off)
  tag: Domain-Specific; see-DOMAIN_SPECIFIC.md

The installer reads these tags and tailors a copy of this file to the
adopter's project at install time. If you're reading the kit verbatim,
all defaults are on.
-->

## The Prime Directive

> **The preferred number of lines of code is zero.**

Every line of code is a liability — it must be written, read, tested, debugged, and maintained. The best implementation of a feature is the simplest one that correctly solves the problem and no more. When in doubt, delete.
<!-- tag: Generic -->

---

## AI Does Fuzzy Logic. Code Does Deterministic Logic.

The single most important architectural rule when an AI model is in the stack: pure functions resolve anything that has a right answer, the model handles anything that doesn't. The two responsibilities never cross. A function decides "is this purchase over the daily limit?" — a model does not. A model decides "what's a friendly way to phrase this rejection?" — a function does not.
<!-- tag: Architecture-Conditional; applies-when: ships-llm-prompts -->

The line is sharper than it sounds in practice. Anything with a single correct outcome — a rules check, a price calculation, a permission test, a state transition — is code. Anything where the goal is style, fit, tone, or interpretation — phrasing, summarization, classification at the margin, content generation — is the model. When a feature seems to need both, the code computes the structural answer and hands the model the context to phrase it; the model never reverse-engineers the structural answer from prose.

A model that's asked to do deterministic work will get it right most of the time and silently wrong some of the time. A function that's asked to do creative work will be flat and repetitive. Each tool is wrong for the other job.

See `DOMAIN_SPECIFIC.md` for a worked example of the full taxonomy applied to a narrative-game pipeline.

---

## KISS — Keep It Simple

> The best solution is the one a newcomer can understand at a glance.
<!-- tag: Generic -->

- **No clever abstractions** for things that only happen once
- **No configuration objects** where a parameter suffices
- **No class hierarchies** where a function suffices
- **No state machines** where a simple value suffices

A timer-based feature is a good example of KISS applied. Imagine a system that has to charge a recurring subscription, advancing a "days into the billing cycle" counter and triggering at month-end. The naive design reaches for a state machine, a pause/resume event flow, and a separate aggregator service:

```typescript
// The entire mechanic in one function
function advance(subscription: Subscription, days: number): void {
  subscription.daysIntoCycle += days
  if (subscription.daysIntoCycle >= subscription.cycleLengthDays) {
    subscription.state = 'due'
  }
}
// No pause state. No resume flow. No event system. One function.
```

---

## SOLID

### Single Responsibility

Each class, function, and module does exactly one thing. If you need the word "and" to describe what something does, it does too much.
<!-- tag: Generic -->

- `DiceRoller` rolls dice formulas — it does not apply modifiers or check results.
- `EmailSender` sends an email — it does not decide which template to use or whether to send.
- `User` holds account state — it does not compute analytics descriptions.
- `BillingService` computes invoice line items — it does not send the invoice.
- `SearchClient` queries the search index — it does not decide ranking strategy.

### Open / Closed

Domain-defining data lives in data (templates, lookup tables, config), not scattered through logic. Adding a new template should not require touching existing code — you add a new template file.
<!-- tag: Generic -->

### Liskov Substitution

Implementations of an interface are substitutable. All model backends implement a `TextAdapter` / `EmbeddingAdapter` / `ImageAdapter` interface behind role-typed clients (`StoryClient`, `UtilityClient`, etc.) aggregated in a `Clients` container. Swapping a backend (one provider for another) is done by adding an adapter class and changing the role config — no caller changes. See `examples/decisions/028-client-layer.md`.
<!-- tag: Generic -->

### Interface Segregation

Consumers receive only the context they need. A `BillingService` does not receive search-pipeline state. A `SearchClient` does not receive the billing context. Pass the minimum required interface, not a god object.
<!-- tag: Generic -->

### Dependency Inversion

Business logic depends on role-typed interfaces (`EmailClient`, `SearchClient`, `PaymentClient`) — not on Resend, OpenSearch, Stripe, or any SDK directly. Concrete adapters are injected at startup by a registry. Business code never imports vendor SDK packages.
<!-- tag: Generic -->

---

## DRY — Don't Repeat Yourself

Every piece of knowledge has one authoritative source:
<!-- tag: Generic -->

| Knowledge | Authoritative source (example) |
|---|---|
| Domain rules (validation, business invariants) | A `domain/` or shared package — one place |
| Dice randomness | `DiceRoller` — nowhere else |
| Non-dice randomness | `Random` — `Math.random` is forbidden in business logic; UI may use it for pure presentation (animation jitter) that never affects state |
| Persistent state | One repository / data service per record type, scoped by tenant or owner |
| Configuration | One config module — never `process.env.*` scattered through business code |
| Computed values | Derived at read time from the source of truth, never stored redundantly |

If the same logic appears in two places, one of them is wrong.

---

## YAGNI — You Aren't Gonna Need It

Do not build for hypothetical future requirements. Build exactly what the current design calls for.
<!-- tag: Generic -->

- No plugin system unless the design requires plugins
- No configuration flags for behaviors that are always on
- No abstract base classes for things with one implementation
- No generic event systems when a direct function call suffices
- No versioning infrastructure until there are multiple versions

When a new requirement arrives, add what it needs then. Until then, the code does not contain it.

**If the concern is concrete enough that it could corner a *current* design** — e.g. "we'll eventually have multi-tenant support; does this query layer assume single-tenant forever?" — record it in a `FUTURE_CONSIDERATIONS.md` file instead of pre-building. That doc's job is to keep the future in view without writing speculative code: "stay alert" is not the same as "build scaffolding."

---

## Default to Less

The Prime Directive ("the preferred number of lines of code is zero") is the headline rule. The traps below are the patterns that cause violations of it in practice — re-read this list before starting work on any decision doc or feature.
<!-- tag: Generic -->

**Reflexive class creation.** When the actual work is "build an object literal and call one method," don't wrap it in a class with an interface and a factory. The default for new code is *inline at the call site*. Add structure only when a concrete second consumer or a real abstraction boundary justifies it. A new file that exports one class with one method that does one HTTP call needs to justify why it isn't a private method on the existing caller.

**Anticipatory engineering.** Don't build for consumers that don't exist yet. A replay CLI for a workflow nobody runs, a `LogContext` parameter for filterability nobody uses, a date subfolder for a reader nobody wrote, a config knob with one valid value, a factory branching on a single boolean — every one of these is rework in disguise. Build for today's concrete consumer; if "today" has no consumer, ship the smallest writer and let the reader's needs shape the path *when the reader actually arrives*.

**Implementing a design doc verbatim instead of questioning it.** A design doc with `**Status:** Proposed` is a draft, not a contract. If you find yourself building a section that strikes you as speculative, *stop and push back on the doc before coding it*. The conversation costs ten minutes; coding the speculation and re-litigating it in PR review costs a week. Doc says "secret-pattern scanning"? Ask whether tokens can actually reach this surface. Doc says "FIFO queue with drain task"? Ask whether HTTP isn't already that. Doc says "thread `LogContext` through every chat call site"? Ask whether the data isn't already in `RequestContext`.

**Doubling down when challenged.** When a reviewer says "still too complex," the right response is to question the *whole shape*, not trim the named issue. If you patched the slice when the reviewer pointed at the day partition, you missed the point. Read every "this is over-engineered" comment as a directive to cut more aggressively than the comment names. The user shouldn't have to coach the same point three times.

**Layer duplication that the type system can't catch.** A new `interface DocStore { putDoc(...) }` next to an existing `class DataStoreClient { putDoc(...) }` with the same shape is duplication, even if the compiler is happy with it. Before adding any new type, check whether an existing type with the same shape already exists and use that. Before adding any new class wrapping an existing class, check whether the wrapper hides anything callers actually need hidden.

**Threading-cost amnesia.** Adding a parameter to a service signature looks like one line of code. If that parameter has to flow through 22 call sites to reach the consumer, the cost is 22 files plus tests plus mocks plus future maintenance. Before threading anything, ask: is this data per-request (use the request context), per-process (use module scope), or genuinely per-call? Only the third earns the threading.

**The "minimum viable shape" check.** Before writing the first line of code from a design doc, post a one-paragraph summary of "what's the minimum that satisfies the design?" and check in with the owner. If the doc has features you'd cut, name them now, not after the PR is open. The cost of a five-minute alignment conversation is always lower than the cost of a 40-file revert.

**"Why is X needed?" — default-answer is "it isn't."** When the human or another reviewer asks why some piece of code or structure exists, the first answer to consider is "it doesn't need to exist." Defend only with a *concrete consumer that exists today*, not a hypothetical one. "We might want to filter by template later" is not a defence; "the eval CLI does this filter" is. If the eval CLI doesn't exist, the field doesn't exist.

**Human consumers count.** A "concrete consumer" doesn't have to be code. Tags on issues, structured labels in error messages, comment markers like `[#NN]` or `[story]`, sortable timestamp fields, audit-log columns, HTML-comment metadata — these often have no code consumer but a real human consumer who searches and filters with them. "I grep for this tag" is a concrete consumer. "I sort the report by this column" is a concrete consumer. Reviewers should not flag human-consumer-only fields as YAGNI just because no function reads them.

---

## No Interim Implementations

When a design document has picked a shape, build to that shape. Do not ship a simpler "v1" with a TODO to revisit. Do not split into "phase 1 easy thing, phase 2 real thing" as a way of deferring the hard part. Framing like "big lift," "separate PR later," "minimum viable interim," or "pragmatic v1" is a smell — if the design is decided, the interim is just rework in disguise.
<!-- tag: Personal Preference; default-on -->
<!-- override: a team that genuinely ships in user-visible phases (alpha → beta → GA) may legitimately want a staged build. The rule still applies inside a phase: don't ship throwaway code that the next phase has to rewrite. -->

**The two valid reasons to ship a smaller cut:**

1. The design itself is genuinely incomplete — in which case stop coding and finish the design doc first.
2. A true bisection where the interface is a coherent unit and the implementation is a coherent follow-up with matching tests — not a dodge on the hard part.

Before writing any implementation, re-read the relevant decision docs and verify the plan matches the design; if it doesn't, the plan is wrong, not the design.

The reflex "ship something simpler now, refine later" is rework with extra steps. The interim has to be torn out, the call sites have to be migrated, and the design conversation has to be re-litigated in PR review instead of in the design doc where it belongs.

---

## Design Review Checklist

Before finalizing any new code, ask:
<!-- tag: Generic -->

1. **Single responsibility.** Is each class / function doing exactly one job? If a caller has to know implementation details (like checking sequence IDs, or knowing whether to sync to a server), the abstraction is leaking.
2. **Right owner.** Does this logic belong in the class that owns the data? Persistence logic belongs in the data layer. Domain rules belong in the domain package. UI components should only call high-level methods, never orchestrate low-level operations.
3. **Simplify the caller.** Can the call site be reduced to one line? If the caller needs multiple steps (save locally, then sync, then check version), those steps should be inside the method it's calling.
4. **Already handled.** Is there an existing system that already manages this concern? Don't duplicate responsibility — extend the existing owner instead.
5. **Shared code, shared package.** If both client and server need the same logic, it belongs in a shared package. Never duplicate domain rules between apps.
   <!-- tag: Architecture-Conditional; applies-when: client-server-split -->
6. **No god classes.** A god class is one that breaks single responsibility: blending unrelated capabilities into one place, tightly coupling things that should be independent, hard to test, a nightmare to debug. Those are the smells to chase. Size alone is not a god class. A large class with one cohesive concern, all methods sharing the same dependencies and consumers, and a clean test strategy is fine; it is earning its size. When a class crosses ~300 lines or ~8-10 methods, pause and ask: is this becoming a god class, or is it still cohesive? Evaluate against the smells (distinct *axes of change*, *independent client contracts*, *unrelated test strategies*, non-overlapping consumers). Split when the smells are real; otherwise keep it whole and consider extracting branches into named *private* helpers within the same file. The `class_size_audit` agent runs this evaluation periodically and writes a report to `.claude/reports/` for review. Entry-point methods (orchestrators) stay pure orchestration: a numbered list of single method calls on focused services, no inline logic.

---

## Comments

Default to zero comments. Well-named identifiers and small focused functions are the documentation. Only write a comment when the WHY is genuinely non-obvious: a hidden invariant, a subtle ordering constraint, a workaround for a specific bug, a trade-off that surprises the reader.
<!-- tag: Generic -->

- **One line when you must.** Multi-paragraph comments belong in design docs (`docs/decisions/`) or PR descriptions, not in source files.
- **Never explain WHAT the code does.** Method names, type names, and function shape are the explanation. If the reader needs a comment to understand the happy path, rename the method.
- **Do not narrate the current task.** No "added for PR #X", "see ticket Y", "used by the streaming path"; that rots the moment the surrounding code changes.
- **Do not write prose tuning notes.** A multi-line block listing each config option and why it was picked belongs in the design doc. The config literal is self-explanatory; a one-line tag is enough in code.
- **No file-header comment blocks.** A 5-15 line preamble at the top of a source file repeating what the class does, when it was created, who owns it, what it integrates with — all of that belongs in the class name, the decision doc, or git blame. Don't write it.
- **Headers / ASCII-art dividers (`// ── section ──`) are fine sparingly.** They delimit long files. They are not comments about behavior.

When reviewing a diff and you see a block of prose comments, assume the code wants to be rewritten with clearer names instead. The comment is a symptom.

---

## Timeouts, Intervals, and Retries

**All timeouts, intervals, lifetimes (TTLs), and retry caps live in one config block. Never inline as literals.** On a typical TypeScript backend that is a `TimeoutConfig` in `config.ts`. On the frontend that is `Settings.ts`. In Python services it is the service's own `config.py`.
<!-- tag: Generic -->

- **Read at the call site, defined once.** `config.timeouts.sseHeartbeatMs`, `config.timeouts.persistOpsMaxRetries`, etc. Never `15_000` or `3` sitting in a function body.
- **One knob, one name.** If two call sites use the same 10-second timeout for conceptually-different reasons, they get two different config entries. The config file is the catalog of tunables.
- **Adapter options come from the config block.** Database client, model client, HTTP client — they take their timeouts via their constructor from `config.timeouts`, not inlined.
- **Frontend timers.** `Settings.ts` is the home for user-visible timeouts (idle timers, debounce windows, animation durations that matter for UX); shared design tokens like transition speeds stay in CSS.
  <!-- tag: Architecture-Conditional; applies-when: has-frontend -->

When a reviewer can't answer "where would I change the heartbeat interval?" in under five seconds, the rule has been violated.

---

## No Backwards Compatibility

**This project has one client, always at the latest version. There is no "old client" to support.** Do not write code that accommodates a missing field, a legacy shape, or an out-of-date caller.
<!-- tag: Personal Preference; default-on -->
<!-- override: if your project ships a public API with external consumers (mobile apps, third-party integrators), backwards compatibility is a real requirement; replace this section with your versioning policy. -->

- **No optional-for-backwards-compatibility parameters.** If a method now requires an `idempotencyKey`, the parameter is required. Callers that forget to pass it are a bug, not a supported path.
- **No missing-header / missing-field fallbacks.** If a route needs a header, it returns 400 when the header is absent. Do not silently degrade into "run the old path."
- **No dual-schema reads.** When a record shape changes, write the migration, run it, and delete the old-shape reader. Records in the store match the current types; there is no "if this field is missing, assume v1."
- **No deprecation markers.** We do not keep `@deprecated` aliases, shim methods, or "will be removed in v2" comments. Remove the thing; let the compiler find the callers.
- **No feature flags for the rollout.** A change lands or it doesn't. Temporary flags to stage a client update are not needed; there is one client, it ships in lockstep with the server.

This rule explicitly overrides any reflex to "add an optional for safety." Safety here comes from a compiler that catches every caller at once, not from a runtime branch.

---

## Testing

**Every test must be deterministic, offline, and fast.** Flakiness is a P1 bug — higher priority than most features. A test that only passes "sometimes" is not a test; fix it or delete it.

Full testing rules — the philosophy, intent-first naming for tests and parameters, mocking discipline, failure-mode coverage, AAA structure, behavior bundling, flaky-test smell patterns, and test-utility shape — live in [`engineering/TESTING_PRINCIPLES.md`](TESTING_PRINCIPLES.md). The `phil_testing` PR-review agent and the `flaky_test_finder` weekly audit both read that file as their source of truth.
<!-- tag: Generic -->

### Delta operations: server-authoritative, client eventually consistent

A pattern used when both client and server need to apply the same state changes to a shared record. The server owns the canonical record (in the datastore, indexed by tenant + record, with an optimistic `sequenceId`). The client holds a cached copy and applies the same delta operations the server applied so the two stay in sync.
<!-- tag: Architecture-Conditional; applies-when: client-server-split + has-shared-state -->
<!-- worked-example: see DOMAIN_SPECIFIC.md § "Turn-based state machine with typed delta operations" for the WorldOps pattern applied to a turn-based game. -->

A `DeltaOps` (or `WorldOps`, `RecordOps`, pick the noun that fits) is the contract for those deltas. Both client and server import the same `apply()` function; the server applies the op, persists, and bumps `sequenceId`; the client applies the same op locally on receipt. New op types extend a discriminated union; the exhaustive switch in `apply()` makes "I forgot to handle this op" a compile error, not a runtime bug.

---

## Class-Based Design

Everything lives in a class. There are no free-standing exported functions.
<!-- tag: Personal Preference; default-on -->
<!-- override: a team that prefers a functional style (especially in Python or Go) may legitimately disagree. Replace this section with your own organizing principle (module-level functions with explicit dependencies, etc.). The downstream rules about "one class per file" become "one exported symbol set per file" in that case. -->

**Three class archetypes:**

| Archetype | Has state? | Examples |
|---|---|---|
| **Stateful component** | Yes | `User`, `Cart`, `Workspace`, `Subscription` |
| **Static utility** | No | `DiceRoller`, `Random`, `Formatter`, `WeightedPicker` |
| **Service / Agent** | Injected deps only | `BillingService`, `EmailService`, `SearchAgent` |

Static utility classes group related pure operations under one import. You pull in `Formatter` once and call `Formatter.toCurrency()`, `Formatter.toDuration()` — rather than importing each function individually. All methods are `static`, no instantiation required.

```typescript
// Good — one import, all formatting operations available
import { Formatter } from '@kit/utils/Formatter'
Formatter.toCurrency(amount, 'USD')
Formatter.toDuration(ms)
Formatter.toRelativeDate(timestamp)

// Avoid — scattered imports for related operations
import { toCurrency, toDuration, toRelativeDate } from '@kit/utils/format'
```

**Static utility methods are still pure** — same inputs always produce the same outputs (modulo intentional randomness in `DiceRoller`), no side effects, no shared mutable state. The class is purely an organizational container.

**Stateful components expose typed methods, not raw properties.** Internal state is private; mutation goes through methods that keep the object consistent.

**Services and agents are instantiated classes** with constructor-injected dependencies. One public method per role.

---

## Naming Conventions — Suffixes Are Contracts

Every class suffix in this codebase carries a specific meaning. When you read `FooService` or `FooClient` or `FooHandler`, you should already know roughly what the class does and how it's wired. Suffixes are not decoration — they're contracts with the reader.
<!-- tag: Personal Preference; default-on -->
<!-- override: if your team uses different suffixes (Manager / Controller / Worker), replace the table below with your house contracts. The rule that "suffixes carry meaning" still applies. -->

### Primary suffixes

| Suffix | Meaning | Rule of thumb |
|---|---|---|
| **Orchestrator** | Top-level entry point; coordinates Services in numbered steps; **no inline logic** | Reading the method body looks like a table of contents |
| **Service** | Does significant work **inside this process**; holds domain logic; may call Clients or other Services internally | The real work happens here |
| **Client** | Access layer that **crosses a process / container boundary** (HTTP, IPC); thin forwarding wrapper | I pushed the work somewhere else |
| **Agent** | Wraps an AI model call with prompt + memory + response parsing | I call an LLM in a specific role |
| **Handler** | Processes one specific job or event type dispatched by a Scheduler or Bus | I run when X happens |
| **Adapter** | Backend-specific implementation of a generic interface; **private to its folder** — consumers use Clients, not Adapters | Swap me to change backends |
| **Registry** | Maps keys to instances; lookup / discovery facade | Ask me to find X |
| **Scheduler** | Queues work for later execution | Submit and forget |
| **Generator** | Static-method namespace for deterministic production; **no state, no instantiation** | Call my static methods |
| **Builder** | Assembles one complex object from inputs; may be static-methods or instance | Give me the parts, I return the object |
| **Bus** | Pub / sub event dispatch | Emit or subscribe |

### Secondary suffixes (single-purpose)

| Suffix | Meaning | Examples |
|---|---|---|
| **Parser** | Transforms raw text into typed output | `JSONParser` |
| **Formatter** | Transforms structured data into text | `DateFormatter` |
| **Sanitizer** | Strips or normalises unsafe / invalid input | `InputSanitizer`, `TextSanitizer` |
| **Catalog** | Static lookup table of reference data | `ItemCatalog` |
| **Context** | Request-scoped ambient state carrier | `RequestContext`, `AgentContext` |
| **Record** | Plain-data interface (no methods, type-only) | `UserRecord`, `WorkspaceRecord` |

### Client vs. Service — the distinction

The Client / Service line is the one most worth internalising:

- **Client** = crosses a network boundary. The work happens **elsewhere**. The class is thin — validate inputs, serialise a request, dispatch, parse a response. Examples: `StoryClient` → a model container, `DataStoreClient` → the database container, `EmailClient` → an external email provider.

- **Service** = does significant work **here**. Orchestrates, transforms, applies domain logic, holds request state. Examples: `BillingService` (applies pricing rules), `SummaryService` (calls a model client then writes to memory), `MechanicsService` (runs a multi-pass pipeline locally).

A class that calls a remote system **and** applies meaningful local logic around it is a **Service**, not a Client. The Client is what it uses to reach the remote system.

### Plain nouns (no suffix)

Stateless domain data and their static operation namespaces use the domain noun directly — no suffix needed. Examples: `User`, `Item`, `Workspace`, `Campaign`. These are either type-only `interface`s (records) or `class`es that own only static methods over the record shape (`User.createNew`, `User.applyDefaults`). This is an established pattern; don't retrofit a suffix onto an existing domain component.

### Python services follow the same rules

For polyglot codebases, Python code uses the same naming conventions as TypeScript — **camelCase for identifiers we own** (functions, variables, parameters, dict keys we emit), **PascalCase for classes**, **UPPER_CASE for module-level constants**. `snake_case` appears only where we interop with stdlib / framework APIs that dictate parameter names (`torch_dtype`, `num_inference_steps`, etc.).
<!-- tag: Architecture-Conditional; applies-when: has-python -->
<!-- override: most Python projects follow PEP 8 (snake_case throughout); pick PEP 8 if your team prefers Python convention over cross-language consistency. -->

The tradeoff: consistency across the codebase beats conformance to Python convention, because identifiers cross the wire between TypeScript and Python (JSON log fields, HTTP request bodies). One casing convention eliminates the transliteration tax.

```python
# Good — names we own are camelCase
_requestIdCtx: ContextVar[str] = ContextVar("requestId", default=None)

def nowIsoMs() -> str: ...

async def bootstrap() -> None:
    setPhase("loading")
    pipe = await asyncio.to_thread(loadPipeline)

# Framework APIs keep their snake_case — we don't own those
pipe = FluxPipeline.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16)
```

### React hook exception — `useXController` is allowed

The no-`Controller` rule applies to **classes**. React hooks (`use*`) that bundle a screen's state, effects, and action handlers into one return object are idiomatically called controller hooks in the React ecosystem, and we use that name here too. Example: `useGameplayController` owns all gameplay-screen state plus data-layer effects plus action handlers; the screen consumes the returned object as pure composition.
<!-- tag: Architecture-Conditional; applies-when: has-react -->

The rule of thumb: if it's a `function use*` that returns `{ state, actions }` for a specific screen or component, `Controller` is an acceptable suffix. The rule against `Controller` *classes* still stands — pick `Service` or `Orchestrator` there.

### When introducing a new class

1. Decide what the class **does**, then pick the suffix that matches.
2. If nothing fits, don't invent a new suffix — the class probably belongs in an existing suffix or should be split.
3. If you're tempted to call it `FooManager`, `FooHelper`, `FooUtil`, or `FooController` (class, not hook): stop. None of those are on this list. Pick one that is.

See `examples/decisions/028-client-layer.md` for the Adapter / Client layering that motivated the Client vs. Service split.

---

## Failure Policy — Fail Loud, Never Fabricate

When a server-side operation hits an unrecoverable error — model call, JSON parse, persistence, anything on a user-critical path — it surfaces a structured error and lets the client decide what to do next. It does **not** quietly substitute placeholder data, empty arrays, default records, random-error one-liners, or other "graceful degradation" data and keep going.
<!-- tag: Generic -->

**Rule:** on the critical path there are no silent fallbacks. Catch at the outermost layer only. Route handlers return `{ error, reason }` with an error status. Clients show the reason and offer the user a real recovery choice — retry is the default.

**Why:** fabricated data is worse than a visible failure. A response that approximately looks right during the current session ships a silent correctness bug that compounds every subsequent operation. A loud failure produces one retry click; a silent fallback produces hours of weird downstream behavior before anyone notices the root cause.

**Exception:** background / advisory operations (image generation, cache warming, prefetches, analytics writes, optional memory writes) may log and skip. They are not on the user's critical path and their absence degrades presentation, not correctness. If you're unsure whether an operation is critical, assume it is.

**Retry > fallback.** Graceful degradation is a polite name for shipping broken data.

### What this rule is NOT about: user-facing UX on failure

"Fail loud" is about **data correctness**, not the UI copy the user sees. The two are independent:

| Layer | Rule |
|---|---|
| **Server** | On unrecoverable failure on the critical path, throw. No fabricated content, no stubbed results, no empty-response "success", no silent retry that guesses a result. The route handler catches once at the boundary, logs with full context, and returns `500 { error }`. Every layer below the route throws; catches exist only to add a named log tag before re-throwing (see `examples/decisions/037-fail-loud.md`). |
| **Client** | The user does not see a stack trace. On a `5xx` response the client reverts any optimistic state, shows a short friendly message ("something went sideways, try again"), and lets the user resubmit. That is graceful UX, not graceful degradation. |

A server-side catch that persists a default record, writes a placeholder to memory, returns synthetic data, returns a stubbed result, or advances state as if the operation succeeded is a violation. The next operation's context now contains fabricated data and the bug compounds.

If you're uncertain which side of the line you're on, ask: "does the next operation see something that didn't really happen?" If yes, it's fabrication and belongs in the server-must-throw column. If no (the error stayed on the wire and the client rewound), it's polite UX.

### Rollback — open design question

Multi-step server operations that mutate persistent state need a rollback / compensation mechanism so "retry" is safe. Operations that today are already transactional (one final write at the end — a mid-flight failure leaves nothing on disk) are fine. Future multi-step server operations must be designed reversibly. The full rollback pattern is its own design doc; flag any new multi-step write path when designing it.

---

## Addressing — One Path String, Not Parameter Salads

Every handler, service method, route body, job payload, and wire type that needs to identify "where in a nested hierarchy this operation applies" carries a single `path: string` field. The path is a REST-style string of typed segments.
<!-- tag: Architecture-Conditional; applies-when: has-nested-state-hierarchy -->
<!-- worked-example: see DOMAIN_SPECIFIC.md § "Path-string addressing for nested records" for the StoryPath pattern. -->

```
/tenant/t1/workspace/w1/project/p1/task/k1/comment/c1
```

Any subset, any order, parsed by a `Path` utility at the top of the function for a typed destructure.

**Rule:** do not add scattered `tenantId` / `workspaceId` / `projectId` parameters to new signatures. One `path: string` parameter; parse it at the top of the function. Adding a new addressable kind (say `attachment`) means adding one line to the `PathKind` enum — signatures don't change.

**Why:** signatures stay stable as the hierarchy grows. New segment types become parser-only changes, not a codebase sweep.

---

## The Result Type — No Throwing from Business Logic

Fallible operations return a discriminated union, not an exception:
<!-- tag: Personal Preference; default-on -->
<!-- override: a codebase that uses exceptions consistently (typical Python / Java style) may prefer to keep throwing. The rule then becomes "exceptions only for truly exceptional failures; return values for expected failure modes." Both styles work; pick one and stick to it. -->

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: string }

function resolvePurchase(buyer: User, item: Item): Result<Purchase> {
  // never throws — always returns a Result
}
```

Exceptions are for genuinely unexpected failures (network down, corrupted data). Business logic never throws — it returns a result and the caller handles it. This keeps the call stack clean and makes error handling explicit.

---

## Component Design Rules

- **One exported class or function set per file**, named to match the filename
- **No circular dependencies** — if A imports B and B imports A, the design is wrong
- **No god objects** — if a class has more than ~7 public methods, it is doing too much (see Design Review Checklist #6 for the longer discussion of when size is a smell)
- **Computed properties are derived at read time**, not stored redundantly:
<!-- tag: Generic -->

```typescript
// Good — computed from source of truth
get attainedProgress(): number {
  return Math.min(100, (this.daysTrained / this.daysNeeded) * 100)
}

// Bad — stored separately and risks going stale
this.attainedProgress = (this.daysTrained / this.daysNeeded) * 100
```

---

## Refactoring Heuristics — How to Read a Diff

These are the patterns we apply when reviewing a diff and deciding whether the shape is right. Each is a question the reader should ask before approving any orchestrator-side or service-side change.
<!-- tag: Generic -->

**1. Orchestrators read like a chain of method names.** An entry-point method (e.g. `processAction`) should be a numbered list of single calls — `validate(input)`, `apply(rules)`, `persist(result)`. Five-line inline blocks that build state, persist, and return belong in a private helper named for what it does (`persistAndReturnResponse`). When in doubt: would a reader who knows nothing about the implementation understand the operation shape from method names alone? If no, extract.

**2. Logic lives with the data it owns.** If the orchestrator looks up a user, workspace, project, and project members, that's `ContextBuilder` territory — same data walk it already does, different projection. If the orchestrator decides "is this a results-only operation?", that's the relevant service's territory — same service that owns the resolution. Push helpers down to whichever class owns the underlying domain. The orchestrator is a coordinator; it does not duplicate logic that lives elsewhere.

**3. Predicates over inline conditions.** `if (MechanicsService.requiresUserAction(directive))` reads better than `if (directive?.type === 'check')`. Named predicates carry intent and survive future-type-additions without rewriting the call site. Static methods on the owning class are the natural home.

**4. Side-effect packaging belongs with the producer.** When a service decides one signal and that signal then has to be merged into a context alongside other signals before a downstream call runs, that whole packaging step belongs on the producing service — not in the orchestrator. The orchestrator hands the service everything it needs and gets back a ready-to-use context. This collapses three orchestrator lines into one and keeps the merge logic next to the thing that produces the primary signal.

**5. Verify before designing.** When deciding whether to build a cache, a job, or a denormalised field, first check whether the data is already on the durable record and just isn't being projected. Greps before grand designs. A semantic store is often a denormalised cache of state already present on the canonical record — projecting deterministically beats caching strategies most of the time.

**6. Deterministic over LLM / memory when the data exists.** If the data is on the durable record, project it. If it requires semantic recall (e.g. "what is relevant to *this* user input?"), that's the model-calling agent's job after the orchestrator hands it the structural context. The action loop never makes a vector query for data that is already on the record in structural form.
<!-- tag: Architecture-Conditional; applies-when: ships-llm-prompts -->

**7. Trade context size for completeness when the budget allows.** A small structural projection that ships every relevant event in the parent chain is worth the tokens — durable, consistent, no surprises. Slicing or truncating to "save context" introduces decisions the next reader has to reverse-engineer. Don't `slice(-N)` projections; cap at write-time if growth becomes a real problem.
<!-- tag: Architecture-Conditional; applies-when: ships-llm-prompts -->

**8. Skip work that won't be observed.** When an operation short-circuits before the model call (fast-path, guard block), the per-call work the model would have consumed (catch-up generation, mid-context compaction, suggestions) is wasted. Background jobs handle the catch-up work; the synchronous path short-circuits before paying for it. Symmetrically: when a fresh action carries no `mechanicsResult` and the directive needs a user action, do not invoke the model. Run only the work whose output the user will see.
<!-- tag: Architecture-Conditional; applies-when: ships-llm-prompts -->

These show up as PR review questions. If a diff adds a five-line block to the orchestrator, the question is "where does this belong?" If a diff adds an inline `?.type === '...'` check, the question is "what's the named predicate?" If a diff calls a memory query before the model, the question is "is the underlying data on the record?"

---

## Two Failed Attempts → Look It Up

When a fix doesn't work and the second attempt also doesn't, stop iterating in a vacuum. WebSearch / WebFetch the specific signature (error string, component versions, stack involved). These problems have been solved before. Patching symptom-by-symptom is how you burn an afternoon discovering a one-line config flag documented in a GitHub discussion.
<!-- tag: Generic -->

---

## Three Failed Attempts → Step Back

Related to the "look it up" rule above, but broader. When you've tried the same task three times and it's still wrong, stop pushing on the narrow problem and zoom out. The fourth narrow attempt costs roughly the same as a re-think and almost always pays back worse.

Applies to any engineering task: deploys that don't come up, tests that won't go green, refactors that keep growing, prompt iterations that don't move the needle, design choices that keep producing the same mistake. After three attempts:

1. Stop. Don't open the editor for the fourth attempt yet.
2. Re-read the original ask, the original error, the original constraint. Half of "this isn't working" is a misread of what "working" means.
3. Question one of your assumptions explicitly. Common offenders: "the right tool for this is X," "this should fit in one file," "this is a one-line fix," "the framework does this for me."
4. If the broader view says yes, you were on the right path, then go look it up (the rule above). If the broader view says you were on the wrong path, abandon the attempt; don't sunk-cost it.
5. Resist the reflex to create a new doc / file / config / abstraction to escape the problem. An existing one almost always wants to be amended instead.

A worked example: a flaky deploy where attempts 1-3 added retries / wait loops / health-check tweaks. Attempt 4 should not be "more retries"; the broader-view question is "is the service actually starting correctly, or am I masking a startup ordering bug?"

The cost of pausing for a re-read is small; the cost of three more narrow attempts is large and usually grows.
<!-- tag: Generic -->

---

## Review Etiquette — Advisory, Not Blocking

The agent reviewers in this kit (Alice, Bob, Phil, Gomez, Carl, Jekyll, Hyde) are advisory. They post findings; they never block merge. Three rules govern how they should behave, especially across multiple review cycles on the same PR.
<!-- tag: Generic -->

**Rule 1: Findings are advisory, never blocking.** No agent posts `REQUEST_CHANGES`; they post `APPROVE` or `COMMENT`. The PR author filters every finding through their own judgment (often via a separate conversation with a primary chat agent that helps them sort signal from noise). A finding the author chose not to act on is not a finding the reviewer should re-post next round. Silence is consent.

**Rule 2: Diminishing returns on subsequent review cycles.** When a reviewer sees the author has already pushed changes in response to prior reviews (the PR has a posted review and the head SHA has advanced since), the bar tightens, not loosens. Specifically:

- Only flag findings that are NEW in this push (introduced by the diff between the prior reviewed SHA and the current HEAD).
- Do not relitigate findings from prior rounds. If the author saw the prior comment and didn't act, the call is theirs.
- Do not introduce minor new style nits on the second round that didn't appear on the first. The first round is the broad pass; the second round is targeted at what just changed.
- Cap inline comments at half the first-round budget when reviewing Round 2+ (e.g., 7 instead of 15). If you find more than that, the diff is large enough that it deserves its own first-round-style review and the author probably knows.

**Rule 3: Flag fixes that are worse than the original.** When the new push contains a "fix" responding to prior feedback that introduced more complexity, worse naming, or undid a virtue the prior version had, that's a higher-priority finding than anything else. "Your fix to my prior comment is worse than the original code; here's why" beats five new minor flags. The goal isn't to make code perfect; it's to make sure that responses to reviews don't degrade the code below where it started.

The philosophy underneath all three: a review is never trying to make code perfect. It's trying to surface the highest-leverage findings on the first pass; everything after that has diminishing returns. Reviewers respect the author's judgment that "good enough" has been reached.

---

## No New Config or Env Files

Don't reflexively create `.local.json`, `.example.yml`, `something.config.js` per feature. The few legitimate config files in any project are: secrets (`.env.secrets`-style, gitignored), one main config module per service, and provider-routing JSON if your stack has runtime provider selection.
<!-- tag: Personal Preference; default-on -->
<!-- override: if your project genuinely uses many config files (a microservices monorepo, for instance), drop this rule. It exists to push back on the reflex of "I need a place for this knob; let me make a file" when extending an existing config block is the right move. -->

Before creating a new config or env file, ask: can I extend an existing one? Use an existing mechanism? Ask the person you're working with before you commit a new file.

---

## CSS — Styles Belong in `global.css` First

The preferred number of CSS lines in a component module is zero.
<!-- tag: Architecture-Conditional; applies-when: has-frontend + has-css-modules -->

**The hierarchy:**

| Layer | File | Purpose |
|---|---|---|
| Design tokens | `src/styles/global.css` `:root` | All colours, fonts, spacing — one source of truth |
| Shared styles | `src/styles/global.css` | Button variants, text utilities, any class used by 2+ components |
| Component layout | `ComponentName.module.css` | Flex / grid structure, padding, component-specific overrides only |
| Inline styles | — | Never |

**Before writing a new rule in a `.module.css` file, ask:** could this be a global utility class? If so, put it in `global.css` and `composes` it in:

```css
/* LandingScreen.module.css */
.menuButton {
  composes: btn btn-ghost from '../../styles/global.css';
  /* component-specific override only if genuinely needed */
}
```

**Design tokens never live in component files.** All `--color-*`, `--font-*`, `--radius`, `--spacing` are declared once in `global.css :root`. Components reference them via `var(--token)` — they never define their own values.

**Duplication in CSS is a bug.** If the same colour value, font size, or transition appears in two component modules, one of them is wrong.
