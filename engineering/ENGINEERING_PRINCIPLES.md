# Engineering Principles

## The Prime Directive

> **The preferred number of lines of code is zero.**

Every line of code is a liability — it must be written, read, tested, debugged, and maintained. The best implementation of a feature is the simplest one that correctly solves the problem and no more. When in doubt, delete.

---

## KISS — Keep It Simple

> The best solution is the one a newcomer can understand in 30 seconds.

- **No clever abstractions** for things that only happen once
- **No configuration objects** where a parameter suffices
- **No class hierarchies** where a function suffices
- **No state machines** where a simple value suffices

---

## SOLID

### Single Responsibility
Each class, function, and module does exactly one thing. If you need the word "and" to describe what something does, it does too much.

- `UserService` manages users — it does not send emails
- `EmailClient` sends email — it does not know about users
- `AuthService` validates tokens — it does not fetch user profiles
- `DataStoreClient` persists records — it does not apply business rules

### Open/Closed
Domain rules live in data (constants, config, templates), not scattered through logic. Adding a new variant does not require touching existing code — you add a new config entry.

### Liskov Substitution
All backends implement typed adapter interfaces. Swapping an implementation (e.g. Postgres → SQLite, Stripe → mock) is done by providing a new adapter class and updating the injection config — no business-logic changes.

### Interface Segregation
Services receive only the context they need. Pass the minimum required interface, not a god object.

### Dependency Inversion
Business logic depends on interfaces, not on concrete SDKs or infrastructure. Concrete adapters are injected at startup. Business classes never import SDK packages directly.

---

## DRY — Don't Repeat Yourself

Every piece of knowledge has one authoritative source. If the same logic appears in two places, one of them is wrong.

Examples of common violations:
- Validation logic duplicated between the API handler and the service layer
- The same timeout value hardcoded in multiple call sites instead of read from config
- Business rules re-implemented in both the client and the server

---

## YAGNI — You Aren't Gonna Need It

Do not build for hypothetical future requirements. Build exactly what the current design calls for.

- No plugin system unless the design requires plugins
- No configuration flags for behaviors that are always on
- No abstract base classes for things with one implementation
- No generic event systems when a direct function call suffices
- No versioning infrastructure until there are multiple versions

When a new requirement arrives, add what it needs then. Until then, the code does not contain it.

If a concern is concrete enough that it could corner a current design, record it in a `FUTURE_CONSIDERATIONS.md` or decision doc instead of pre-building. "Stay alert" is not the same as "build scaffolding."

---

## Default to Less

The Prime Directive is the headline rule. The traps below are the patterns that cause violations of it in practice.

**Reflexive class creation.** When the actual work is "build an object literal and call one method," don't wrap it in a class with an interface and a factory. The default for new code is inline at the call site. Add structure only when a concrete second consumer or a real abstraction boundary justifies it.

**Anticipatory engineering.** Don't build for consumers that don't exist yet. A config knob with one valid value, a factory branching on a single boolean, a parameter added for filterability nobody uses — every one of these is rework in disguise. Build for today's concrete consumer; let the reader's needs shape the path when the reader actually arrives.

**Implementing a design doc verbatim instead of questioning it.** A design doc with `Status: Proposed` is a draft, not a contract. If you find yourself building a section that strikes you as speculative, stop and push back on the doc before coding it. The conversation costs ten minutes; coding the speculation and re-litigating it in PR review costs a week.

**Doubling down when challenged.** When a reviewer says "still too complex," the right response is to question the whole shape, not trim the named issue. Read every "this is over-engineered" comment as a directive to cut more aggressively than the comment names.

**Layer duplication the type system can't catch.** A new `interface RecordStore { put(...) }` next to an existing `class DataStoreClient { put(...) }` with the same shape is duplication, even if TypeScript is happy with it. Before adding any new type, check whether an existing type with the same shape already exists.

**Threading-cost amnesia.** Adding a parameter to a service signature looks like one line of code. If that parameter has to flow through many call sites to reach the consumer, the cost is many files plus tests plus mocks plus future maintenance. Before threading anything, ask: is this data per-request (use request context), per-process (use module scope), or genuinely per-call? Only the third earns the threading.

**The "minimum viable shape" check.** Before writing the first line of code from a design doc, post a one-paragraph summary of "what's the minimum that satisfies the design?" If the doc has features you'd cut, name them now, not after the PR is open.

**"Why is X needed?" — default-answer is "it isn't."** When the human or another reviewer asks why some piece of code or structure exists, the first answer to consider is "it doesn't need to exist." Defend only with a concrete consumer that exists today, not a hypothetical one.

---

## No Interim Implementations

When a design document has picked a shape, build to that shape. Do not ship a simpler "v1" with a TODO to revisit. Framing like "big lift," "separate PR later," "minimum viable interim," or "pragmatic v1" is a smell — if the design is decided, the interim is just rework in disguise.

**The two valid reasons to ship a smaller cut:**

1. The design itself is genuinely incomplete — in which case stop coding and finish the design doc first.
2. A true bisection where the interface is a coherent unit and the implementation is a coherent follow-up with matching tests — not a dodge on the hard part.

Before writing any implementation, re-read the relevant decision docs and verify the plan matches the design; if it doesn't, the plan is wrong, not the design.

---

## Design Review Checklist

Before finalizing any new code, ask:

1. **Single responsibility.** Is each class/function doing exactly one job? If a caller has to know implementation details, the abstraction is leaking.
2. **Right owner.** Does this logic belong in the class that owns the data? Persistence logic belongs in the data layer. Business rules belong in the service layer. UI components should only call high-level methods, never orchestrate low-level operations.
3. **Simplify the caller.** Can the call site be reduced to one line? If the caller needs multiple steps, those steps should be inside the method it's calling.
4. **Already handled.** Is there an existing system that already manages this concern? Don't duplicate responsibility — extend the existing owner instead.
5. **No god classes — but size isn't the smell, it's the trigger.** When a class crosses ~300 lines or ~8-10 methods, stop and evaluate — don't reflexively split. A class is a god class only when it has distinct axes of change, independent client contracts, or unrelated test strategies smushed together. A large cohesive class with many related operations sharing clients/state and overlapping consumers is fine. Before splitting, ask: do the consumers of the two halves overlap? Would the split force every call site to instantiate/inject both pieces? If yes, the class is earning its size — keep it whole and consider extracting branches into named private helpers within the same file instead.

---

## Comments

Default to zero comments. Well-named identifiers and small focused functions are the documentation. Only write a comment when the WHY is genuinely non-obvious: a hidden invariant, a subtle ordering constraint, a workaround for a specific bug, a trade-off that surprises the reader.

- **One line when you must.** Multi-paragraph comments belong in design docs or PR descriptions, not in `.ts` files.
- **Never explain WHAT the code does.** Method names, type names, and function shape are the explanation.
- **Do not narrate the current task.** No "added for PR #X", "see ticket Y", "used by the streaming path" — that rots the moment the surrounding code changes.
- **Headers / ASCII-art dividers are fine sparingly.** They delimit long files. They are not comments about behavior.

When reviewing a diff and you see a block of prose comments, assume the code wants to be rewritten with clearer names instead. The comment is a symptom.

---

## Timeouts, Intervals, and Retries

**All timeouts, intervals, TTLs, and retry caps live in one config block. Never inline as literals.**

- **Read at the call site, defined once.** `config.timeouts.httpRequestMs`, `config.timeouts.maxRetries`, etc. Never `15_000` or `3` sitting in a function body.
- **One knob, one name.** If two call sites use the same 10-second timeout for conceptually different reasons, they get two different config entries. The config file is the catalog of tunables.
- **Adapter options come from the config block.** Database adapters, HTTP clients, etc. take their timeouts via constructor from the config, not inlined.

When a reviewer can't answer "where would I change the retry count?" in under five seconds, the rule has been violated.

---

## No Backwards Compatibility

**One client, always at the latest version. There is no "old client" to support.** Do not write code that accommodates a missing field, a legacy shape, or an out-of-date caller.

- **No optional-for-backcompat parameters.** If a method now requires a parameter, it is required. Callers that forget to pass it are a bug, not a supported path.
- **No missing-field fallbacks.** If a route needs a header, it returns 400 when the header is absent. Do not silently degrade into "run the old path."
- **No dual-schema reads.** When a record shape changes, write the migration, run it, and delete the old-shape reader.
- **No deprecation markers.** We do not keep `@deprecated` aliases, shim methods, or "will be removed in v2" comments. Remove the thing; let the compiler find the callers.
- **No feature flags for the rollout.** A change lands or it doesn't.

This rule explicitly overrides any reflex to "add an optional for safety." Safety here comes from a compiler that catches every caller at once, not from a runtime branch.

---

## Testing

**Every test must be deterministic, offline, and fast.** A flaky or slow test is a broken test; it poisons the CI signal and trains everyone to ignore failures.

- **No real-time waits.** Never `setTimeout(resolve, 100)`, never `await sleep(n)`, never poll with a real clock. Tests that exercise timer-based logic use fake timers (`vi.useFakeTimers()`, jest fake timers, etc.).
- **No real network or disk.** Mock at the boundary: `fetch`, database clients, external service clients. Unit tests never hit real infrastructure. Integration tests that need a real service are a different tier and gated separately.
- **Budgets.** Individual test under 500ms wall-clock, full suite under 10 seconds. If a test exceeds the per-test budget, check for real waits or heavy setup.
- **Isolation.** Each test owns its setup; no shared mutable state between cases. Clear mocks before every test.
- **Test the contract, not the implementation.** Assert on observable behavior (return values, emitted events, recorded mock calls), not on internal state shape. Refactors that keep the contract should keep the tests green.

A test that only passes "sometimes" is not a test. Fix the flakiness or delete it.

---

## Class-Based Design

Everything lives in a class. There are no free-standing exported functions.

**Three class archetypes:**

| Archetype | Has state? | Examples |
|---|---|---|
| **Stateful component** | Yes | Domain entities and aggregates |
| **Static utility** | No | `Arr`, `DateUtils`, `Crypto` |
| **Service / Agent** | Injected deps only | `AuthService`, `EmailService` |

Static utility classes group related pure operations under one import. All methods are `static`, no instantiation required.

**Static utility methods are still pure** — same inputs always produce the same outputs, no side effects, no shared mutable state. The class is purely an organizational container.

**Stateful components expose typed methods, not raw properties.** Internal state is private; mutation goes through methods that keep the object consistent.

**Services and agents are instantiated classes** with constructor-injected dependencies.

---

## Naming Conventions — Suffixes Are Contracts

Every class-suffix carries a specific meaning. When you read `FooService` or `FooClient` or `FooHandler`, you should already know roughly what the class does and how it's wired. Suffixes are not decoration — they are contracts with the reader.

### Primary suffixes

| Suffix | Meaning | Rule of thumb |
|---|---|---|
| **Orchestrator** | Top-level entry point; coordinates Services in numbered steps; no inline logic | Reading the method body looks like a table of contents |
| **Service** | Does significant work inside this process; holds domain logic; may call Clients internally | The real work happens here |
| **Client** | Access layer that crosses a process/container boundary (HTTP, IPC); thin forwarding wrapper | I pushed the work somewhere else |
| **Agent** | Wraps an AI model call with prompt + context + response parsing | I call an LLM in a specific role |
| **Handler** | Processes one specific job or event type dispatched by a Scheduler or Bus | I run when X happens |
| **Adapter** | Backend-specific implementation of a generic interface; private to its folder | Swap me to change backends |
| **Registry** | Maps keys to instances; lookup/discovery facade | Ask me to find X |
| **Scheduler** | Queues work for later execution | Submit and forget |
| **Generator** | Static-method namespace for deterministic production; no state, no instantiation | Call my static methods |
| **Builder** | Assembles one complex object from inputs | Give me the parts, I return the object |
| **Bus** | Pub/sub event dispatch | Emit or subscribe |

### Secondary suffixes (single-purpose)

| Suffix | Meaning | Examples |
|---|---|---|
| **Parser** | Transforms raw text into typed output | `JSONParser` |
| **Formatter** | Transforms structured data into text | `ReportFormatter` |
| **Sanitizer** | Strips or normalizes unsafe/invalid input | `InputSanitizer` |
| **Context** | Request-scoped ambient state carrier | `RequestContext` |
| **Record** | Plain-data interface (no methods, TS-only) | `UserRecord` |

### Client vs. Service — the distinction

The Client/Service line is the one most worth internalizing:

- **Client** = crosses a network boundary. The work happens elsewhere. The class is thin — validate inputs, serialize a request, dispatch, parse a response.
- **Service** = does significant work here. Orchestrates, transforms, applies domain logic, holds request state.

A class that calls a remote service AND applies meaningful local logic around it is a **Service**, not a Client. The Client is what it uses to reach the remote system.

### Plain nouns (no suffix)

Stateless domain data and their static operation namespaces use the domain noun directly — no suffix needed. Examples: `User`, `Order`, `Invoice`. These are either TS `interface`s (records) or `class`es that own only static methods over the record shape.

### When introducing a new class

1. Decide what the class does, then pick the suffix that matches.
2. If nothing fits, don't invent a new suffix — the class probably belongs in an existing suffix or should be split.
3. If you're tempted to call it `FooManager`, `FooHelper`, `FooUtil`, or `FooController`: stop. None of those are on this list. Pick one that is.

### React hook exception — `useXController` is allowed

The no-`Controller` rule applies to classes. React hooks (`use*`) that bundle a screen's state, effects, and action handlers into one return object are idiomatically called controller hooks in the React ecosystem, and we use that name here too.

The rule of thumb: if it's a `function use*` that returns `{ state, actions }` for a specific screen or component, `Controller` is an acceptable suffix. The rule against `Controller` classes still stands — pick `Service` or `Orchestrator` there.

---

## Failure Policy — Fail Loud, Never Fabricate

When a server-side operation hits an unrecoverable error on a user-critical path — model call, JSON parse, persistence, external service — it surfaces a structured error and lets the client decide what to do next. It does **not** quietly substitute placeholder data, empty arrays, default records, or other "graceful degradation" data and keep going.

**Rule:** on the critical path there are no silent fallbacks. Catch at the outermost layer only. Route handlers return `{ error, reason }` with an error status. Clients show the reason and offer the user a real recovery choice — retry is the default.

**Why:** fabricated data is worse than a visible failure. A response with default data looks approximately right during the current request but ships a silent correctness bug that compounds. A loud failure produces one retry click; a silent fallback produces hours of confusing downstream behavior before anyone notices the root cause.

**Exception:** background / advisory operations (cache warming, prefetches, optional telemetry) may log and skip. They are not on the user's critical path and their absence degrades presentation, not correctness.

**Retry > fallback.** Graceful degradation is a polite name for shipping broken data.

### What this rule is NOT about: user-facing UX on failure

"Fail loud" is about data correctness, not the UI copy the user sees. The two are independent:

| Layer | Rule |
|---|---|
| **Server** | On unrecoverable failure on the critical path, throw. No fabricated responses, no stubbed data, no silent retry that guesses a result. The route handler catches once at the boundary, logs with full context, and returns `500 { error }`. |
| **Client** | The user does not see a stack trace. On a `5xx` response the client reverts any optimistic state, shows a short friendly message, and lets the user resubmit. That is graceful UX, not graceful degradation. |

A server-side catch that persists a default record, returns synthetic data, or advances state as if the operation succeeded is a violation. The next request's context now contains fabricated data and the bug compounds.

---

## The Result Type — No Throwing from Business Logic

Fallible operations return a discriminated union, not an exception:

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: string }

function validateOrder(order: Order): Result<ValidatedOrder> {
  // never throws — always returns a Result
}
```

Exceptions are for genuinely unexpected failures (network down, corrupted data). Business logic never throws — it returns a result and the caller handles it. This keeps the call stack clean and makes error handling explicit.

---

## Component Design Rules

- **One exported class or function set per file**, named to match the filename
- **No circular dependencies** — if A imports B and B imports A, the design is wrong
- **No god objects** — if a class has more than ~7 public methods, it is doing too much
- **Computed properties are derived at read time**, not stored redundantly:

```typescript
// Good — computed from source of truth
get progressPercent(): number {
  return Math.min(100, (this.completed / this.total) * 100)
}

// Bad — stored separately and risks going stale
this.progressPercent = (this.completed / this.total) * 100
```

---

## Refactoring Heuristics — How to Read a Diff

**1. Orchestrators read like a chain of method names.** An entry-point method should be a numbered list of single calls. Five-line inline blocks that do multiple things belong in a private helper named for what it does.

**2. Logic lives with the data it owns.** If the orchestrator is doing work that belongs to a service (building a context, making a domain decision), push that logic into the service. The orchestrator is a coordinator; it does not duplicate logic that lives elsewhere.

**3. Predicates over inline conditions.** `if (OrderService.requiresApproval(order))` reads better than `if (order.total > 1000 && order.type === 'B2B')`. Named predicates carry intent and survive future-type additions without rewriting the call site.

**4. Side-effect packaging belongs with the producer.** When a service produces a signal and that signal has to be assembled into a response alongside other signals, that packaging step belongs on the service — not in the orchestrator.

**5. Verify before designing.** When deciding whether to build a cache, a job, or a denormalized field, first check whether the data is already on the durable record and just isn't being projected. Greps before grand designs.

**6. Skip work that won't be observed.** When a request short-circuits early, skip work whose output the caller won't see.

These show up as PR review questions. If a diff adds a multi-line block to the orchestrator, the question is "where does this belong?". If a diff adds an inline condition, the question is "what's the named predicate?".

---

## CSS — Styles Belong in global.css First

The preferred number of CSS lines in a component module is zero.

**The hierarchy:**

| Layer | File | Purpose |
|---|---|---|
| Design tokens | `src/styles/global.css` `:root` | All colours, fonts, spacing — one source of truth |
| Shared styles | `src/styles/global.css` | Button variants, text utilities, any class used by 2+ components |
| Component layout | `ComponentName.module.css` | Flex/grid structure, padding, component-specific overrides only |
| Inline styles | — | Never |

**Before writing a new rule in a `.module.css` file, ask:** could this be a global utility class? If so, put it in `global.css` and `composes` it in:

```css
/* MyComponent.module.css */
.submitButton {
  composes: btn btn-primary from '../../styles/global.css';
}
```

**Design tokens never live in component files.** All `--color-*`, `--font-*`, `--radius`, `--spacing` are declared once in `global.css :root`. Components reference them via `var(--token)` — they never define their own values.

**Duplication in CSS is a bug.** If the same colour value, font size, or transition appears in two component modules, one of them is wrong.
