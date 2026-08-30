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

## Write So Anyone Can Read It

**Would a developer in Hanoi, reading English as their second language, understand this the first time?**
<!-- tag: Generic -->

Most design failures are communication failures. This rule covers three kinds of writing, and it is the same rule for all three: text a user sees, design documents, and code.

[ISO 24495-1:2023](https://www.iso.org/standard/78907.html) is the international plain-language standard. It sets four tests. Writing passes when it is:

- **Findable.** Headings say what the section is about, so a reader can go straight to the part they need.
- **Understandable.** The words match what the reader already knows. Aim at B1: someone fluent but not native.
- **Actionable.** The reader knows what to do next.
- **Consistent.** The same idea uses the same word every time.

Seven rules follow from that:

1. **Use the plain word.** Write "belongs to" instead of "hangs off". Write "structure" instead of "shape of the thing". If a shorter and more common word means the same, use it.
2. **One idea per sentence.** A sentence holding two clauses and a dash is usually two sentences.
3. **Put the point first, then the reason.** A reader who stops after one sentence should still have the answer.
4. **Do not invent a term.** If the code already has a word for something, use that word. If it does not, use the ordinary English one.
5. **No idioms, and no metaphors that need a culture to decode.** "Belt and braces", "out of the gate" and "punching above its weight" do not survive translation, and they do not survive a reader who learned English from documentation.
6. **Write out an abbreviation the first time it appears** on a page.
7. **Name the thing you mean.** "It", "this" and "that" at the start of a sentence make the reader look backwards to find out what is being discussed.
8. **Carry the context, do not assume it.** The reader was not in the conversation that produced the sentence. An instruction has to say what to do, where it applies, and what happens if it is skipped. If the reader would have to ask "which one", "where", "why that number", or "what if I don't", it is not finished. This is not a licence to write more: the words to spend are the ones carrying the instruction, and the ones to cut are usually the ones justifying a conclusion you have already stated.

**Rule 1 is not a rule against precision.** It is a rule against decoration. Removing a word that carries meaning makes the writing worse. Removing a word that only carries style makes it better.

**In code, the same rule is about names.** A name is the sentence most people read. `solvedPerTier` says what it returns; `handle` and `process` say nothing. A comment explains why the code is surprising. If it explains what the code does, the code needed a better name instead.

**In text a user reads, the rule is stricter**, because the reader may be tired, in a hurry, or reading a translation. If your project ships translated strings, give every string a note saying what it means and where it appears, so a translator never has to guess.

This rule governs every document in this kit. `STYLE.md` adds presentation conventions on top of it.

---

## The Prime Directive

> **The preferred number of lines of code is zero.**

Every line of code is a liability. It must be written, read, tested, debugged, and maintained. The best implementation of a feature is the simplest one that correctly solves the problem and no more. When in doubt, delete.
<!-- tag: Generic -->

---

## The Working Loop — Design First, Ask, Test, Build, Clean Up

**The question:** _before I write implementation code, is the design settled, are the tests written against it, and do I know what this change makes dead?_
<!-- tag: Personal Preference; default-on -->
<!-- override: this loop assumes you keep decision docs and write tests before implementation. If your team designs as it builds, or does not keep decision records, drop this section and keep "No Interim Implementations" as the weaker form of the same idea. Steps 1 and 2 are the parts that depend on decision docs; steps 3-5 stand on their own. -->

Every code change runs the same five steps in order. The failure mode this section exists to stop: an implementation that ran ahead of its design, shipped without the tests that pin it, and left the superseded code behind. The steps differ in one place (step 2) depending on whether a human operator is driving the session or a scheduled agent is running autonomously; everything else is identical for both.

1. **Match the change to its design.** Read the decision doc the work traces to. The implementation builds the shape the doc picked (see "No Interim Implementations"). If the doc has a gap, an open question, or an undecided mechanism the implementation would otherwise have to guess at, stop here. Do not guess, do not mint a new decision doc for the gap, and do not defer the question to a follow-up PR.

2. **Resolve the gap before any code.** How you resolve it depends on who is driving:
   - **Working with an operator (a live session):** ask the clarifying questions now. Write the answers into the decision doc that already owns the choice in this same change: extend it, do not mint a new number. See [`BACKLOG_WORKFLOW.md`](BACKLOG_WORKFLOW.md). Then continue.
   - **Running autonomously (a scheduled agent, no operator):** resolve the gap from the existing design corpus (the approved decision plus the docs it links). If the gap needs an architectural call nobody has made, use the escape hatch rather than guessing: open a draft PR carrying the design question and stop for the owner. An autonomous agent never guesses past a real ambiguity and never proceeds on an unsettled design.

3. **Write the tests against the design, before the implementation.** Both tiers, per [`TESTING_PRINCIPLES.md`](TESTING_PRINCIPLES.md), following the red-first discipline in the `test-driven-development` skill. The tests encode the decision doc's acceptance criteria. Watch each one fail for the right reason before writing a line of production code.

4. **Implement to green, validating against the suite as you go.** Write the minimum production code that turns the tests green. Re-run the suite after each step; a pre-existing test that breaks means a contract changed, so fix the implementation, not the test.

5. **Remove what this change supersedes.** Deleting the code your change made dead is part of the change, not a later cleanup. See "Remove What You Supersede".

---

## AI Does Fuzzy Logic. Code Does Deterministic Logic.

The single most important architectural rule when an AI model is in the stack: pure functions resolve anything that has a right answer, the model handles anything that doesn't. The two responsibilities never cross. A function decides "is this purchase over the daily limit?" A model does not. A model decides "what's a friendly way to phrase this rejection?" A function does not.
<!-- tag: Architecture-Conditional; applies-when: ships-llm-prompts -->

The line is sharper than it sounds in practice. Anything with a single correct outcome (a rules check, a price calculation, a permission test, a state transition) is code. Anything where the goal is style, fit, tone, or interpretation (phrasing, summarization, classification at the margin, content generation) is the model. When a feature seems to need both, the code computes the structural answer and hands the model the context to phrase it; the model never reverse-engineers the structural answer from prose.

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

**The question:** before writing any method, ask _who owns this responsibility?_
<!-- tag: Generic -->

Each class, function, and module does exactly one thing. If you need the word "and" to describe what something does, it does too much. State and the behavior that maintains it live on the same entity. If you are about to write code on `Y` that asks `Y`'s caller to bring data back, you have split a single responsibility across two places, and the answer to the question is "not `Y`."

The forcing test, applied per line you write:

> _If I deleted this from where I'm about to put it and moved it to the entity that owns the state, would the call site shrink without losing capability?_

If yes, the new line is on the wrong entity. Side-effects that update an object's own state are not a smell when that is what the object exists for; the smell is one object holding the state and another object doing the work. Well-encapsulated code is short at every layer: when an orchestrator, client, or route handler grows past roughly one method call per line, it is almost always doing work the entities below it should be doing instead.

Worked answers, in the shape to write for your own codebase:

| Question | Answer | Implication |
| --- | --- | --- |
| Who owns randomness? | `Random` | All randomness routes through it; never `Math.random` in testable logic |
| Who owns sending mail? | `EmailSender` | Choosing the template and deciding whether to send are not its job |
| Who owns account state? | `User` | Analytics descriptions are not `User`'s job |
| Who owns invoice line items? | `BillingService` | Delivering the invoice is not its job |
| Who owns index queries? | `SearchClient` | Ranking strategy is not its job |
| Who owns parsing a composite identifier? | The identifier type itself | Every caller asks it; no caller re-parses |
| Who owns mutations to a record's invariants? | That record's mutation API | Every caller goes through it; no caller spreads-and-replaces |

### Open / Closed

**The question:** _if I add a new variant tomorrow (a new template, plan tier, item type, or backend), do I need to touch existing code?_

If yes, the rule lives in logic instead of data; move it. A class is open for extension and closed for modification. When you find yourself reaching back into the same class for the *third* time to add another variant of the same behavior, the variants belong outside the class: typically as data, a strategy object, or a composed collaborator.
<!-- tag: Generic -->

Two common shapes this takes:

- **Data-driven extension.** Domain-defining data lives in data files (templates, lookup tables, config), not scattered through logic. Adding a new template should not require touching existing code. You add a new template file and the system picks it up.
- **Strategy-shaped extension.** When the variation is behavioral, not data-shaped, the variants implement a common interface and get composed in. Adding a new variant means writing a new class that implements the interface; the consumer never changes.

**YAGNI rules over OCP for new code.** Don't build extension points speculatively. The first and second variant live inline; the third variant is when you extract. Premature extension points are anticipatory engineering (see "Default to Less").

### Liskov Substitution

**The question:** _can I swap one implementation for another without changing the callers?_

If callers know which concrete backend they are talking to, they are coupled to the wrong layer. Implementations of an interface are substitutable. All model backends implement a `TextAdapter` / `EmbeddingAdapter` / `ImageAdapter` interface behind role-typed clients (`StoryClient`, `UtilityClient`, etc.) aggregated in a `Clients` container. Swapping a backend (one provider for another) is done by adding an adapter class and changing the role config: no caller changes. See `examples/decisions/028-client-layer.md`.
<!-- tag: Generic -->

### Interface Segregation

**The question:** _what is the minimum each caller needs to know?_
<!-- tag: Generic -->

Pass that, and only that. Consumers receive only the context they need. A `BillingService` does not receive search-pipeline state. A `SearchClient` does not receive the billing context. Pass the minimum required interface, not a god object. If a method takes a god object so the body can pick three fields out of it, the signature is lying about what it depends on.

### Dependency Inversion

**The question:** _does this class know about a specific backend, or about a contract?_

If it knows about a named vendor or SDK directly, the layering is inverted. Business logic depends on role-typed interfaces (`EmailClient`, `SearchClient`, `PaymentClient`), not on Resend, OpenSearch, Stripe, or any SDK directly. Concrete adapters are injected at startup by a registry. Business code never imports vendor SDK packages.
<!-- tag: Generic -->

---

## Beyond SOLID — Additional Design Principles

Four design principles from Freeman & Bates's *Head First Design Patterns* that SOLID doesn't cover directly. These are the patterns to reach for when a class genuinely needs structure, not licenses to add structure for its own sake. The Prime Directive still applies: prefer zero lines of new abstraction; these principles describe the *shape* of the abstraction when you're already adding one.
<!-- tag: Generic -->

### Encapsulate What Varies

Identify the parts of the system that change for different reasons or at different rates, and isolate them from the parts that stay the same. The stable parts depend on an interface; the varying parts implement it. New variation becomes a new implementation, not edits to the stable core.
<!-- tag: Generic -->

Encapsulating what varies is the affirmative pair to "Default to Less." Default to Less defends against unjustified abstraction. *Encapsulate What Varies* names the case where abstraction IS justified: the variation is real, it is present today, and it currently lives as nested `if` and `switch` branches scattered across the codebase.

Signals you have real variation worth encapsulating:

- The same `if (type === 'X') ... else if (type === 'Y') ...` branch appears in three or more places.
- A new variant requires editing five different files to add a fourth `case`.
- Different team members have edited the same method to add their own variants in series.

When you see those signals, extract the variants behind a common interface. When you don't see them, leave the code alone: anticipating variation that may never arrive is anticipatory engineering.

### Composition Over Inheritance

Prefer "has-a" to "is-a." When a class needs new behavior, hold a reference to an object that provides that behavior, rather than inheriting from a base class that provides it.
<!-- tag: Generic -->

Inheritance creates a tight, compile-time coupling between parent and child: any change to the parent's contract ripples through every subclass. Composition lets behavior be swapped, combined, and tested in isolation.

Use inheritance only when:

- The relationship is genuinely an "is-a" (a `CardPayment` *is a* `Payment`, not a `CardPayment` *has-a* `Payment`).
- The shared base is small, stable, and unlikely to grow new responsibilities (`Result<T, E>` discriminated union; an `Error` hierarchy used only for `instanceof` checks).
- Composition would force callers to repeatedly do the same delegation by hand for no expressive gain.

Default to composition. The instinct to reach for `extends` to share helper methods is almost always wrong: extract the helpers into a class that gets injected, not inherited.

### Law of Demeter — Only Talk to Friends
<!-- tag: Generic -->

A method on object A should call methods on:

1. A itself
2. Objects A holds as fields
3. Objects passed to the method as parameters
4. Objects A creates locally

It should *not* reach through one object to call methods on another object's internals: `a.getB().getC().doThing()` is a Demeter violation. The chain couples A to the internal structure of B (it now knows B has a C that does things), and any restructuring of B breaks A.

Two common false-positive shapes that look like Demeter violations but are not:

- **Fluent interfaces.** `query.where(...).orderBy(...).limit(...)` returns `query` each call; the chain stays on one object. Same with method-chained builders.
- **Collection pipelines.** `items.filter(...).map(...).reduce(...)` is the standard collection idiom; flagging it as a Demeter violation misreads the principle.

A real Demeter finding looks like `user.getAccount().getBilling().getDefaultMethod().getStripeId()`: a chain through four distinct object types where the caller is silently coupled to all four.

The fix is usually not "add a helper method to each intermediate object so the chain becomes one call." The fix is to ask whether the caller really needs the inner thing, or whether the outer object should take on the operation itself (`user.getDefaultPaymentStripeId()`).

### Hollywood Principle — Don't Call Us, We'll Call You

High-level components define the flow; low-level components hook into it. Low-level components do not reach up and call high-level components directly.
<!-- tag: Generic -->

The Hollywood Principle is what sits behind frameworks, event loops, observer registrations, and React's component lifecycle. You register a callback; the framework calls it at the right time; you never invoke the framework's internals from inside your handler.

The smell to watch for: a low-level component (an adapter, a helper, a leaf service) that imports and calls a high-level orchestrator. The dependency arrow points the wrong way. The fix is usually to invert it: the high-level component should pass the low-level component a callback, observe its events, or check its state, rather than the low-level component reaching up.

In practice: a `DatabaseClient` should never import `BillingService` to "notify it" of something. The notification flow is `BillingService` registers a listener with `DatabaseClient`, or `BillingService` polls / queries `DatabaseClient` for the state it needs. The arrow runs from higher-level (more abstract) to lower-level (more concrete), never the other way.

---

## DRY — Don't Repeat Yourself

Every piece of knowledge has one authoritative source:
<!-- tag: Generic -->

| Knowledge | Authoritative source (example) |
|---|---|
| Domain rules (validation, business invariants) | A `domain/` or shared package. One place |
| Randomness | `Random`: `Math.random` is forbidden in business logic; UI may use it for pure presentation (animation jitter) that never affects state |
| Persistent state | One repository / data service per record type, scoped by tenant or owner |
| Configuration | One config module: never `process.env.*` scattered through business code |
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

**If the concern is concrete enough that it could corner a *current* design**: e.g. "we'll eventually have multi-tenant support; does this query layer assume single-tenant forever?" Record it in a `FUTURE_CONSIDERATIONS.md` file instead of pre-building. That doc's job is to keep the future in view without writing speculative code: "stay alert" is not the same as "build scaffolding."

---

## Default to Less

The Prime Directive ("the preferred number of lines of code is zero") is the headline rule. The traps below are the patterns that cause violations of it in practice: re-read this list before starting work on any decision doc or feature.
<!-- tag: Generic -->

**Reflexive class creation.** When the actual work is "build an object literal and call one method," don't wrap it in a class with an interface and a factory. The default for new code is *inline at the call site*. Add structure only when a concrete second consumer or a real abstraction boundary justifies it. A new file that exports one class with one method that does one HTTP call needs to justify why it isn't a private method on the existing caller.

**Anticipatory engineering.** Don't build for consumers that don't exist yet. A replay CLI for a workflow nobody runs, a `LogContext` parameter for filterability nobody uses, a date subfolder for a reader nobody wrote, a config knob with one valid value, a factory branching on a single boolean: every one of these is rework in disguise. Build for today's concrete consumer; if "today" has no consumer, ship the smallest writer and let the reader's needs shape the path *when the reader actually arrives*.

**Implementing a design doc verbatim instead of questioning it.** A design doc with `**Status:** Proposed` is a draft, not a contract. If you find yourself building a section that strikes you as speculative, *stop and push back on the doc before coding it*. The conversation costs ten minutes; coding the speculation and re-litigating it in PR review costs a week. Doc says "secret-pattern scanning"? Ask whether tokens can actually reach this surface. Doc says "FIFO queue with drain task"? Ask whether HTTP isn't already that. Doc says "thread `LogContext` through every chat call site"? Ask whether the data isn't already in `RequestContext`.

**Doubling down when challenged.** When a reviewer says "still too complex," the right response is to question the *whole shape*, not trim the named issue. If you patched the slice when the reviewer pointed at the day partition, you missed the point. Read every "this is over-engineered" comment as a directive to cut more aggressively than the comment names. The user shouldn't have to coach the same point three times.

**Layer duplication that the type system can't catch.** A new `interface DocStore { putDoc(...) }` next to an existing `class DataStoreClient { putDoc(...) }` with the same shape is duplication, even if the compiler is happy with it. Before adding any new type, check whether an existing type with the same shape already exists and use that. Before adding any new class wrapping an existing class, check whether the wrapper hides anything callers actually need hidden.

**Threading-cost amnesia.** Adding a parameter to a service signature looks like one line of code. If that parameter has to flow through 22 call sites to reach the consumer, the cost is 22 files plus tests plus mocks plus future maintenance. Before threading anything, ask: is this data per-request (use the request context), per-process (use module scope), or genuinely per-call? Only the third earns the threading.

**The "minimum viable shape" check.** Before writing the first line of code from a design doc, post a one-paragraph summary of "what's the minimum that satisfies the design?" and check in with the owner. If the doc has features you'd cut, name them now, not after the PR is open. The cost of a five-minute alignment conversation is always lower than the cost of a 40-file revert.

**"Why is X needed?" Default-answer is "it isn't."** When someone asks why a piece of code or structure exists, the first answer to consider is "it doesn't need to exist." Defend only with a *concrete consumer that exists today*, not a hypothetical one. "We might want to filter by template later" is not a defence; "the eval CLI does this filter" is. If the eval CLI doesn't exist, the field doesn't exist.

**Human consumers count.** A "concrete consumer" doesn't have to be code. Tags on issues, structured labels in error messages, comment markers like `[#NN]` or `[story]`, sortable timestamp fields, audit-log columns, HTML-comment metadata. These often have no code consumer but a real human consumer who searches and filters with them. "I grep for this tag" is a concrete consumer. "I sort the report by this column" is a concrete consumer. Reviewers should not flag human-consumer-only fields as YAGNI just because no function reads them.

---

## No Interim Implementations

When a design document has picked a shape, build to that shape. Do not ship a simpler "v1" with a TODO to revisit. Do not split into "phase 1 easy thing, phase 2 real thing" as a way of deferring the hard part. Framing like "big lift," "separate PR later," "minimum viable interim," or "pragmatic v1" is a smell, if the design is decided, the interim is just rework in disguise.
<!-- tag: Personal Preference; default-on -->
<!-- override: a team that genuinely ships in user-visible phases (alpha → beta → GA) may legitimately want a staged build. The rule still applies inside a phase: don't ship throwaway code that the next phase has to rewrite. -->

**The two valid reasons to ship a smaller cut:**

1. The design itself is genuinely incomplete: in which case stop coding and finish the design doc first.
2. A true bisection where the interface is a coherent unit and the implementation is a coherent follow-up with matching tests, not a dodge on the hard part.

Before writing any implementation, re-read the relevant decision docs and verify the plan matches the design; if it doesn't, the plan is wrong, not the design.

The reflex "ship something simpler now, refine later" is rework with extra steps. The interim has to be torn out, the call sites have to be migrated, and the design conversation has to be re-litigated in PR review instead of in the design doc where it belongs.

---

## Design Review Checklist — Six Questions

Ask the six questions below before any new code lands. They are question-shaped because that is how review actually works.
<!-- tag: Generic -->

1. **Single responsibility.** _Is each class / function doing exactly one job?_ If a caller has to know implementation details (like checking sequence IDs, or knowing whether to sync to a server), the abstraction is leaking.
2. **Right owner.** _Does this logic belong in the class that owns the data?_ Persistence logic belongs in the data layer. Domain rules belong in the domain package. UI components should only call high-level methods, never orchestrate low-level operations.
3. **Simplify the caller.** _Can the call site be reduced to one line?_ If the caller needs multiple steps (save locally, then sync, then check version), those steps should be inside the method it's calling.
4. **Already handled.** _Is there an existing system that already manages this concern?_ Don't duplicate responsibility: extend the existing owner instead.
5. **Shared code, shared package.** _Do both client and server need this logic?_ If yes, it belongs in a shared package. Never duplicate domain rules between apps.
   <!-- tag: Architecture-Conditional; applies-when: client-server-split -->
6. **No god classes.** _Does everything in this class answer to one responsibility?_ Thresholds and what to do about them are in [No God Classes](#no-god-classes) below.

---

## No God Classes

**Size is the trigger. A second responsibility is the smell.**
<!-- tag: Generic -->

Count executable code only: not comments, imports, types, markup or stylesheets. A raw line count on a view file measures mostly markup, which is never a reason to split anything.

- **Under 1000 lines:** leave it, and re-evaluate when it grows.
- **Over 1000:** name any functionality that deserves its own class, and why. Usually this one orchestrates and the part to lift drives a different workflow. Responsibility is a clean line to cut on and an easy one to spot.
- **200+ lines on that other responsibility:** split it. Fewer is not worth a file of its own.

Do the split in the pull request that already touches the file. Do not open a refactor-only pull request, and do not file an issue: a cleanup has no deadline, so it loses to every bug and every feature, and filing it only parks it. If it is not worth doing now, leave it, because the next change to the file will raise it again.

Entry-point methods stay pure orchestration: a numbered list of single method calls on focused services, no inline logic. The `class_size_audit` agent runs this evaluation periodically and writes a report to `.claude/reports/`.

---

## Comments

Default to zero comments. Well-named identifiers and small focused functions are the documentation. Only write a comment when the WHY is genuinely non-obvious: a hidden invariant, a subtle ordering constraint, a workaround for a specific bug, a trade-off that surprises the reader.
<!-- tag: Personal Preference; default-on -->
<!-- override: some teams and some domains (regulated code, published libraries, unusual algorithms) expect explanatory comments in source. If that is you, drop this section and state your own comment policy. -->

- **One line when you must.** Multi-paragraph comments belong in design docs (`docs/decisions/`) or PR descriptions, not in source files.
- **Never explain WHAT the code does.** Method names, type names, and function shape are the explanation. If the reader needs a comment to understand the happy path, rename the method.
- **Do not narrate the current task.** No "added for PR #X", "see ticket Y", "used by the streaming path"; that rots the moment the surrounding code changes.
- **Do not write prose tuning notes.** A multi-line block listing each config option and why it was picked belongs in the design doc. The config literal is self-explanatory; a one-line tag is enough in code.
- **No file-header comment blocks.** A 5-15 line preamble at the top of a source file repeating what the class does, when it was created, who owns it, what it integrates with: all of that belongs in the class name, the decision doc, or git blame. Don't write it.
- **Headers / ASCII-art dividers (`// ── section ──`) are fine sparingly.** They delimit long files. They are not comments about behavior.

When reviewing a diff and you see a block of prose comments, assume the code wants to be rewritten with clearer names instead. The comment is a symptom.

---

## Timeouts, Intervals, and Retries

**All timeouts, intervals, lifetimes (TTLs), and retry caps live in one config block. Never inline as literals.** On a typical TypeScript backend that is a `TimeoutConfig` in `config.ts`. On the frontend that is `Settings.ts`. In Python services it is the service's own `config.py`.
<!-- tag: Generic -->

- **Read at the call site, defined once.** `config.timeouts.sseHeartbeatMs`, `config.timeouts.persistOpsMaxRetries`, etc. Never `15_000` or `3` sitting in a function body.
- **One knob, one name.** If two call sites use the same 10-second timeout for conceptually-different reasons, they get two different config entries. The config file is the catalog of tunables.
- **Adapter options come from the config block.** Database client, model client, HTTP client. They take their timeouts via their constructor from `config.timeouts`, not inlined.
- **Frontend timers.** `Settings.ts` is the home for user-visible timeouts (idle timers, debounce windows, animation durations that matter for UX); shared design tokens like transition speeds stay in CSS.
  <!-- tag: Architecture-Conditional; applies-when: has-frontend -->

When a reviewer can't answer "where would I change the heartbeat interval?" in under five seconds, the rule has been violated.

---

## No Backwards Compatibility

**This project has one client, always at the latest version. There is no "old client" to support.** Do not write code that accommodates a missing field, a legacy shape, or an out-of-date caller.
<!-- tag: Architecture-Conditional; applies-when: single-client -->
<!-- override: this section is kept only when nothing outside your repo consumes your API on a version you do not control. If you ship a public API, a mobile app, or an installed client, backwards compatibility is a real requirement and this section is replaced by your versioning policy. That is a fact about your architecture, not a preference. -->

- **No optional-for-backwards-compatibility parameters.** If a method now requires an `idempotencyKey`, the parameter is required. Callers that forget to pass it are a bug, not a supported path.
- **No missing-header / missing-field fallbacks.** If a route needs a header, it returns 400 when the header is absent. Do not silently degrade into "run the old path."
- **No dual-schema reads.** When a record shape changes, write the migration, run it, and delete the old-shape reader. Records in the store match the current types; there is no "if this field is missing, assume v1."
- **No deprecation markers.** We do not keep `@deprecated` aliases, shim methods, or "will be removed in v2" comments. Remove the thing; let the compiler find the callers.
- **No feature flags for the rollout.** A change lands or it doesn't. Temporary flags to stage a client update are not needed; there is one client, it ships in lockstep with the server.

This rule explicitly overrides any reflex to "add an optional for safety." Safety here comes from a compiler that catches every caller at once, not from a runtime branch.

---

## Remove What You Supersede

**The question:** _did this change make any existing code dead? Then deleting it is part of this change._
<!-- tag: Generic -->

"No Backwards Compatibility" says to delete the old-shape reader once the migration runs. This is the same rule stated as a scope boundary. What decides scope is the file you are already editing, not whether your change created the dead code:

- **Code this change supersedes: in scope, same PR, required.** When your change replaces a path, the now-dead code, the now-unused exports, the now-orphaned tests, and the decision doc that path implemented all get removed or updated in the same PR. Leaving them is not tight scope: it ships a half-finished change that the `hanging_refs` audit files back as a defect. If you keep decision docs, a superseded decision moves to your historical folder in the same PR (see [`PR_WORKFLOW.md`](PR_WORKFLOW.md)).
- **Dead code in files you are already touching: remove it while you are there.** A now-unused export, an orphaned branch, or a function with no remaining callers comes out in the same PR, as long as your change already edits that file. It does not matter whether your change killed it or it was already dead. Deleting dead code from a file you have open does not widen the blast radius, and cleaning up dead paths while you are testing the use cases is the point.
- **Dead code in files your change does not otherwise touch: file a follow-up.** Opening unrelated files purely to delete things expands the diff and the reviewer's surface. That work goes to a follow-up issue per [`BACKLOG_WORKFLOW.md`](BACKLOG_WORKFLOW.md), or the `hanging_refs` audit catches it.

The test that separates them: _am I already editing this file for this change?_ If yes, remove the dead code in it. If reaching it means opening a file the change otherwise leaves alone, file it for later.

---

## Testing

**Every test must be deterministic, offline, and fast.** Flakiness is a P1 bug: higher priority than most features. A test that only passes "sometimes" is not a test; fix it or delete it.

Full testing rules: the philosophy, intent-first naming for tests and parameters, mocking discipline, failure-mode coverage, AAA structure, behavior bundling, flaky-test smell patterns, and test-utility shape. Live in [`engineering/TESTING_PRINCIPLES.md`](TESTING_PRINCIPLES.md). The `phil_testing` PR-review agent and the `flaky_test_finder` weekly audit both read that file as their source of truth.
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
| **Static utility** | No | `Random`, `Formatter`, `WeightedPicker`, `PathCodec` |
| **Service / Agent** | Injected deps only | `BillingService`, `EmailService`, `SearchAgent` |

Static utility classes group related pure operations under one import. You pull in `Formatter` once and call `Formatter.toCurrency()`, `Formatter.toDuration()`: rather than importing each function individually. All methods are `static`, no instantiation required.

```typescript
// Good — one import, all formatting operations available
import { Formatter } from '@kit/utils/Formatter'
Formatter.toCurrency(amount, 'USD')
Formatter.toDuration(ms)
Formatter.toRelativeDate(timestamp)

// Avoid — scattered imports for related operations
import { toCurrency, toDuration, toRelativeDate } from '@kit/utils/format'
```

**Static utility methods are still pure**: same inputs always produce the same outputs (modulo intentional randomness in `Random`), no side effects, no shared mutable state. The class is purely an organizational container.

**Stateful components expose typed methods, not raw properties.** Internal state is private; mutation goes through methods that keep the object consistent.

**Services and agents are instantiated classes** with constructor-injected dependencies. One public method per role.

---

## Names Never Leak a Technology

**Does this name survive replacing the thing underneath it?**
<!-- tag: Generic -->

A name says what a thing is for, never what it is built on. Write `primaryDatabase`, not `postgresInstance`. Write `Db`, not `D1Database`. Write `objectStore`, not `s3Bucket`.

The reason is not taste. Every vendor name in an identifier is a small bet that the vendor never changes. When that bet loses, a rename that should touch one interface touches every call site instead. A deployment meant to be portable cannot be portable in its code and married to a vendor in its vocabulary.

Two things the rule does **not** reach. A provider's own resource types are not yours to choose: `google_sql_database_instance` is Terraform's name for a kind of resource, and what is yours is the identifier beside it. And a name for something that genuinely *is* the product is not a leak: a variable holding a Cloud Run URL may say so, because which product's URL it is happens to be the fact.

The test is whether replacing the vendor tomorrow would leave the name lying. `Db` survives Postgres replacing SQLite. `postgresDb` is honest because it *is* the Postgres one. `D1Database` on an interface was a lie the moment a second implementation existed.

---

## Naming Conventions — Suffixes Are Contracts

Every class suffix in this codebase carries a specific meaning. When you read `FooService` or `FooClient` or `FooHandler`, you should already know roughly what the class does and how it's wired. Suffixes are not decoration. They're contracts with the reader.
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
| **Adapter** | Backend-specific implementation of a generic interface; **private to its folder**: consumers use Clients, not Adapters | Swap me to change backends |
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

- **Client** = crosses a network boundary. The work happens **elsewhere**. The class is thin: validate inputs, serialise a request, dispatch, parse a response. Examples: `StoryClient` → a model container, `DataStoreClient` → the database container, `EmailClient` → an external email provider.

- **Service** = does significant work **here**. Orchestrates, transforms, applies domain logic, holds request state. Examples: `BillingService` (applies pricing rules), `SummaryService` (calls a model client then writes to memory), `MechanicsService` (runs a multi-pass pipeline locally).

A class that calls a remote system **and** applies meaningful local logic around it is a **Service**, not a Client. The Client is what it uses to reach the remote system.

### Plain nouns (no suffix)

Stateless domain data and their static operation namespaces use the domain noun directly: no suffix needed. Examples: `User`, `Item`, `Workspace`, `Campaign`. These are either type-only `interface`s (records) or `class`es that own only static methods over the record shape (`User.createNew`, `User.applyDefaults`). This is an established pattern; don't retrofit a suffix onto an existing domain component.

### Python services follow the same rules

For polyglot codebases, Python code uses the same naming conventions as TypeScript: **camelCase for identifiers we own** (functions, variables, parameters, dict keys we emit), **PascalCase for classes**, **UPPER_CASE for module-level constants**. `snake_case` appears only where we interop with stdlib / framework APIs that dictate parameter names (`torch_dtype`, `num_inference_steps`, etc.).
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

The rule of thumb: if it's a `function use*` that returns `{ state, actions }` for a specific screen or component, `Controller` is an acceptable suffix. The rule against `Controller` *classes* still stands: pick `Service` or `Orchestrator` there.

### When introducing a new class

1. Decide what the class **does**, then pick the suffix that matches.
2. If nothing fits, don't invent a new suffix: the class probably belongs in an existing suffix or should be split.
3. If you're tempted to call it `FooManager`, `FooHelper`, `FooUtil`, or `FooController` (class, not hook): stop. None of those are on this list. Pick one that is.

See `examples/decisions/028-client-layer.md` for the Adapter / Client layering that motivated the Client vs. Service split.

---

## Failure Policy — Fail Loud, Never Fabricate

When a server-side operation hits an unrecoverable error: model call, JSON parse, persistence, anything on a user-critical path. It surfaces a structured error and lets the client decide what to do next. It does **not** quietly substitute placeholder data, empty arrays, default records, random-error one-liners, or other "graceful degradation" data and keep going.
<!-- tag: Generic -->

**Rule:** on the critical path there are no silent fallbacks. Catch at the outermost layer only. Route handlers return `{ error, reason }` with an error status. Clients show the reason and offer the user a real recovery choice: retry is the default.

**Why:** fabricated data is worse than a visible failure. A response that approximately looks right during the current session ships a silent correctness bug that compounds every subsequent operation. A loud failure produces one retry click; a silent fallback produces hours of weird downstream behavior before anyone notices the root cause.

**Exception:** background / advisory operations (image generation, cache warming, prefetches, analytics writes, optional memory writes) may log and skip. They are not on the user's critical path and their absence degrades presentation, not correctness. If you're unsure whether an operation is critical, assume it is.

**Retry > fallback.** Graceful degradation is a polite name for shipping broken data.

### The layered shape, concretely
<!-- tag: Generic -->

The rule above is abstract. This is what it looks like wired through a request:

- **Deterministic layer:** returns `Result<T, E>`. It does not throw. See "The Result Type".
- **Critical path:** unrecoverable failures throw, and are caught **once**, at the route boundary. The handler logs the real error and returns a generic error status. No fabricated payload, no stubbed directive, and no empty-but-successful response leaves the server.
- **Client:** reverts optimistic state and offers a real retry. It does not paper over the gap with placeholder content.
- **Non-critical dependencies:** degrade behind an explicit circuit breaker with a stated retry window (a search index or recommendation service returning empty results for 30 seconds beats failing the whole request). This is the exception above, made concrete: the feature is advisory, so its absence degrades presentation, not correctness.
- **Adapters:** retry per adapter with a bounded attempt count from config. If every retry fails, the critical-path rule takes over.
- **Write conflicts:** retry a bounded number of times before surfacing. A conflict is expected under concurrency; an unbounded retry loop is not a policy.

The shape to notice: exactly one catch site on the critical path, and every degradation is named, bounded, and advisory. A `try/catch` in the middle of the deterministic layer that returns a default is the anti-pattern this whole section exists to prevent.

### What this rule is NOT about: user-facing UX on failure

"Fail loud" is about **data correctness**, not the UI copy the user sees. The two are independent:

| Layer | Rule |
|---|---|
| **Server** | On unrecoverable failure on the critical path, throw. No fabricated content, no stubbed results, no empty-response "success", no silent retry that guesses a result. The route handler catches once at the boundary, logs with full context, and returns `500 { error }`. Every layer below the route throws; catches exist only to add a named log tag before re-throwing (see `examples/decisions/037-fail-loud.md`). |
| **Client** | The user does not see a stack trace. On a `5xx` response the client reverts any optimistic state, shows a short friendly message ("something went sideways, try again"), and lets the user resubmit. That is graceful UX, not graceful degradation. |

A server-side catch that persists a default record, writes a placeholder to memory, returns synthetic data, returns a stubbed result, or advances state as if the operation succeeded is a violation. The next operation's context now contains fabricated data and the bug compounds.

If you're uncertain which side of the line you're on, ask: "does the next operation see something that didn't really happen?" If yes, it's fabrication and belongs in the server-must-throw column. If no (the error stayed on the wire and the client rewound), it's polite UX.

### Rollback — open design question

Multi-step server operations that mutate persistent state need a rollback / compensation mechanism so "retry" is safe. Operations that today are already transactional (one final write at the end, a mid-flight failure leaves nothing on disk) are fine. Future multi-step server operations must be designed reversibly. The full rollback pattern is its own design doc; flag any new multi-step write path when designing it.

---

## Addressing — One Path String, Not Parameter Salads

Every handler, service method, route body, job payload, and wire type that needs to identify "where in a nested hierarchy this operation applies" carries a single `path: string` field. The path is a REST-style string of typed segments.
<!-- tag: Architecture-Conditional; applies-when: has-nested-state-hierarchy -->
<!-- worked-example: see DOMAIN_SPECIFIC.md § "Path-string addressing for nested records" for the StoryPath pattern. -->

```
/tenant/t1/workspace/w1/project/p1/task/k1/comment/c1
```

Any subset, any order, parsed by a `Path` utility at the top of the function for a typed destructure.

**Rule:** do not add scattered `tenantId` / `workspaceId` / `projectId` parameters to new signatures. One `path: string` parameter; parse it at the top of the function. Adding a new addressable kind (say `attachment`) means adding one line to the `PathKind` enum: signatures don't change.

**Why:** signatures stay stable as the hierarchy grows. New segment types become parser-only changes, not a codebase sweep.

---

## The Result Type — No Throwing from Business Logic

Fallible operations return a discriminated union, not an exception:
<!-- tag: Architecture-Conditional; applies-when: result-type-idiomatic -->
<!-- override: this section is kept when your language makes a Result-shaped return natural (TypeScript, Rust). In a codebase whose language idiom is exceptions (Python, Java, Ruby, C#), following it means fighting the ecosystem, and the rule becomes "exceptions only for truly exceptional failures; return values for expected failure modes." Both styles work; pick the one your language already pulls toward. -->

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: string }

function resolvePurchase(buyer: User, item: Item): Result<Purchase> {
  // never throws — always returns a Result
}
```

Exceptions are for genuinely unexpected failures (network down, corrupted data). Business logic never throws. It returns a result and the caller handles it. This keeps the call stack clean and makes error handling explicit.

---

## Component Design Rules

- **One exported class or function set per file**, named to match the filename
- **No circular dependencies**: if A imports B and B imports A, the design is wrong
- **No god objects**: a class holding a second responsibility is doing too much, whatever its method count (see [No God Classes](#no-god-classes) for the thresholds)
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

## Behavior Lives With the Entity That Owns It (Orchestrators Only Coordinate)

**The question:** _am I writing condition, effect, or variant-specific logic inside a coordinator?_
<!-- tag: Generic -->

If yes, stop. A coordinator loads entities, persists state, emits events, dispatches to handlers, gathers candidates, and orders work. It does not decide *what a condition does*, *how a condition ends*, or *what a specific variant grants*. Those belong to the entity that owns that state.

**The smell that you got it wrong:** a `switch` or `if` on a kind (`effect.kind === 'expired'`), a type id (`account.tier === 'enterprise'`), or a specific feature id, sitting inside a coordinator.

Three homes, by what the behavior is about:

1. **A condition or effect owns its own lifecycle and restrictions.** How it ends (a repeat check, ends-on-event, a duration) and what it forbids while active live on the condition type itself, resolved from data the condition carries. A coordinator asks the effect ("are you active? what do you block?"); it does not compute the answer.
2. **A variant applies a NAMED effect; it never defines that effect's resolution.** A premium tier says "apply the extended-grace condition to this account" and passes only what is variant-specific (the duration). The condition itself knows how it ends. When the same condition is imposed from three places, its end-rule is defined once on the condition, not three times at the three call sites.
3. **A variant capability is a data-driven feature row the generic engine reads, never a variant-name branch.** A bonus, grant, or rider keys off a feature record that a catalog resolves by variant and level, consumed by the generic path. The generic engine never names a variant; it iterates the active features.

| The behavior | Lives in | Not in |
|---|---|---|
| How a condition ends, and what it restricts | the condition type plus its end-rule data | the coordinator |
| A per-variant hook after some shared event | the per-variant subclass hook | the shared resolution service |
| A bonus to a computation, gated by variant or choice | a feature row read by the generic resolver | the calculation service |
| A permission or capability a choice grants | a data-driven grant folded in when the choice is made | inline derivation in a service |
| Gathering candidates, thresholds, persistence, events | the coordinator (this is its job) | (n/a) |

**The forward test**, applied before you write the code: _if I add this capability for a second variant, does my change touch a coordinator?_ If yes, you are about to hardcode a variant into a coordinator. Define a feature row, a subclass hook, or a condition with its own end-rule instead. Adding a variant should be data plus an effect or feature, never an `if` in a coordinator.

The forward test is the sharpened form of Refactoring Heuristic 2 below ("Logic lives with the data it owns"). The heuristic tells you how to read an existing diff; the forward test tells you what to write before there is a diff to read.

---

## Refactoring Heuristics — How to Read a Diff

Apply the heuristics below when reviewing a diff and deciding whether the shape is right. Each is a question the reader should ask before approving any orchestrator-side or service-side change.
<!-- tag: Generic -->

**1. Orchestrators read like a chain of method names.** An entry-point method (e.g. `processAction`) should be a numbered list of single calls: `validate(input)`, `apply(rules)`, `persist(result)`. Five-line inline blocks that build state, persist, and return belong in a private helper named for what it does (`persistAndReturnResponse`). When in doubt: would a reader who knows nothing about the implementation understand the operation shape from method names alone? If no, extract.

**2. Logic lives with the data it owns.** If the orchestrator looks up a user, workspace, project, and project members, that's `ContextBuilder` territory: same data walk it already does, different projection. If the orchestrator decides "is this a results-only operation?", that's the relevant service's territory: same service that owns the resolution. Push helpers down to whichever class owns the underlying domain. The orchestrator is a coordinator; it does not duplicate logic that lives elsewhere.

**3. Predicates over inline conditions.** `if (MechanicsService.requiresUserAction(directive))` reads better than `if (directive?.type === 'check')`. Named predicates carry intent and survive future-type-additions without rewriting the call site. Static methods on the owning class are the natural home.

**4. Side-effect packaging belongs with the producer.** When a service decides one signal and that signal then has to be merged into a context alongside other signals before a downstream call runs, that whole packaging step belongs on the producing service, not in the orchestrator. The orchestrator hands the service everything it needs and gets back a ready-to-use context. This collapses three orchestrator lines into one and keeps the merge logic next to the thing that produces the primary signal.

**5. Verify before designing.** When deciding whether to build a cache, a job, or a denormalised field, first check whether the data is already on the durable record and just isn't being projected. Greps before grand designs. A semantic store is often a denormalised cache of state already present on the canonical record: projecting deterministically beats caching strategies most of the time.

**6. Deterministic over LLM / memory when the data exists.** If the data is on the durable record, project it. If it requires semantic recall (e.g. "what is relevant to *this* user input?"), that's the model-calling agent's job after the orchestrator hands it the structural context. The action loop never makes a vector query for data that is already on the record in structural form.
<!-- tag: Architecture-Conditional; applies-when: ships-llm-prompts -->

**7. Trade context size for completeness when the budget allows.** A small structural projection that ships every relevant event in the parent chain is worth the tokens: durable, consistent, no surprises. Slicing or truncating to "save context" introduces decisions the next reader has to reverse-engineer. Don't `slice(-N)` projections; cap at write-time if growth becomes a real problem.
<!-- tag: Architecture-Conditional; applies-when: ships-llm-prompts -->

**8. Skip work that won't be observed.** When an operation short-circuits before the model call (fast-path, guard block), the per-call work the model would have consumed (catch-up generation, mid-context compaction, suggestions) is wasted. Background jobs handle the catch-up work; the synchronous path short-circuits before paying for it. Symmetrically: when a fresh action carries no `mechanicsResult` and the directive needs a user action, do not invoke the model. Run only the work whose output the user will see.
<!-- tag: Architecture-Conditional; applies-when: ships-llm-prompts -->

These show up as PR review questions.

- A diff adds a five-line block to the orchestrator: where does this belong?
- A diff adds an inline `?.type === '...'` check: what is the named predicate?
- A diff calls a memory query before the model: is the underlying data already on the record?

---

## Facts Before Fixes

**Have you reproduced it, or are you reasoning about it?**
<!-- tag: Generic -->

Do not change code to chase a symptom you have not seen yourself. Reproduce it first, under the conditions where it happens. Keep the evidence: a screenshot, a log line, or a failing test. A fix aimed at a described defect fixes the description.

The real cost of skipping this is not the wasted change. It is that the wasted change usually works well enough to look like a fix, so the actual defect is now hidden behind something that resembles a solution.

**A defect you cannot demonstrate does not get a pull request.** Spend the time trying to make it fail first: construct the ordering, run it, read the stored result. Code that is correct only because of how its callers happen to be arranged is worth tidying, but it is hygiene rather than a fix, so it rides along with the next change to that file instead of asking for a review of its own.

This matters most for what a unit test cannot check. A test proves a number came from the right function. Only a screenshot proves the sentence fits on the screen.

---

## Follow the Data

**What did you measure, and what are you assuming?**
<!-- tag: Generic -->

Trust the number the machine reports over the number you expect. Ask the process which port it bound, ask the container which image it is running, read the configuration file that already holds the answer. Where a value can be measured, measure it. Where it has to be assumed, say so in a comment at the point where you assume it.

The expensive defects are believable ideas that nobody measured. "A successful bind proves the port was free" and "the proxy forwards the host header unchanged" are both false, and both are one command away from being disproved. Thinking harder disproves neither.

---

## Understand the Root Cause

**Would this change still be needed if the underlying cause were fixed?**
<!-- tag: Generic -->

If the answer is no, the change is a workaround. Ship a workaround only on purpose, with the real cause written down beside it and a reason it was not fixed now.

Symptoms arrive in groups. Three components truncating their text on a narrow screen is one layout that does not fit, not three components that each need a line limit. Fix the cause once instead of the symptom three times, and prefer the fix that deletes the other two.

---

## Ask Rather Than Assume

**Which reading of the requirement did you pick, and would the other one change the work?**
<!-- tag: Generic -->

Where two readings lead to clearly different work, ask. Where they do not, choose one and write the choice down where the next reader will find it: in a comment, a commit message, or a decision document.

Asking costs one message. Assuming costs the implementation, the review, and the rework. The assumption is usually invisible in the diff, so review does not catch it and a user finds it instead.

---

## Troubleshooting Discipline

**How many times have you tried this, and did the approach change?**
<!-- tag: Generic -->

After two failed attempts against the same symptom, look up the exact error and the versions involved in the official documentation. Searching for the specific error string beats a third guess, because the second guess already told you that the model of the problem in your head is wrong.

After three failed attempts on the same task, read the original requirement again and question one assumption before trying a fourth small fix. Consider a flaky deploy where attempts one through three added retries, wait loops, and health-check tweaks. Attempt four should not be more retries. The broader question is whether the service starts correctly at all, or whether the retries are masking a startup ordering bug.

---

## Decision Document Structure

A decision doc is the design contract for a feature. Agents and humans read it to understand intent, implement against it, and audit what shipped. These are the required elements for any decision that spans more than one agent or introduces a new model call. See `templates/decisions/DECISION_TEMPLATE.md` for the skeleton and `examples/decisions/` for worked examples.
<!-- tag: Architecture-Conditional; applies-when: uses-decision-docs -->

**1. Agent responsibility table.** Multi-agent features list every agent in the pipeline, the phase it runs in, and the single question it answers:

```markdown
| Agent               | Phase      | Question answered                                    |
| ------------------- | ---------- | ---------------------------------------------------- |
| `IntentClassifier`  | Pre-model  | What kind of request is this? Is it in scope?         |
| `ContextBuilder`    | Pre-model  | What context does the responder need for this turn?   |
| `ResponderAgent`    | Generation | Execute the response type given. Make no decisions.   |
| `OutcomeEvaluator`  | Post-model | Did the state change? What follow-up does it trigger? |
```

The "question answered" column enforces single responsibility: if an agent's row cannot be reduced to one question, it is doing too much.
<!-- tag: Architecture-Conditional; applies-when: ships-llm-prompts -->

**2. ASCII pipeline flow diagram.** For any feature that chains three or more agents or jobs, include a numbered flow showing inputs, decision points, and branch paths. Use numbered steps, `|` connectors, `├─` and `└─` for branches, bracketed stage labels, and a `↑` pointer for the input that closes the loop.

A diagram is not optional: it is how an agent reads the feature without executing the code. Prose that describes a pipeline in sentences produces ambiguous reading order and conflates stages.

**3. Prompt inventory table with a status column.** Any decision that adds or modifies prompts includes a table with these columns: `Prompt`, `Purpose`, `Model`, `Status`. The `Status` column uses exactly `Shipped` or `TO BUILD`. A doc that lists prompts without a status column forces the reader to audit the filesystem to understand what is implemented.

When a prompt ships, update the status in the same PR that adds the file. An entry that says `TO BUILD` in a doc whose phase section says `SHIPPED` is a contradiction.
<!-- tag: Architecture-Conditional; applies-when: ships-llm-prompts -->

**4. Implementation phases with SHIPPED / TO BUILD markers.** Multi-phase features list each phase with its exact status. Heading format: `### Phase N — Description (SHIPPED)` or `### Phase N — Description (TO BUILD)`. Each `SHIPPED` phase lists the specific files added or modified. This is what makes the doc auditable after the feature lands: a reader can grep the listed filenames to confirm the claim.

**5. Status field tracks implementation state.** The `**Status:**` header line in each decision doc reflects the current implementation state, not the original proposal state. Values: `Proposed`, `Approved`, `Partially Implemented`, `Implemented`. Update it in the same PR that completes the final phase.

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
| Design tokens | `src/styles/global.css` `:root` | All colours, fonts, spacing. One source of truth |
| Shared styles | `src/styles/global.css` | Button variants, text utilities, any class used by 2+ components |
| Component layout | `ComponentName.module.css` | Flex / grid structure, padding, component-specific overrides only |
| Inline styles |: | Never |

**Before writing a new rule in a `.module.css` file, ask:** could this be a global utility class? If so, put it in `global.css` and `composes` it in:

```css
/* LandingScreen.module.css */
.menuButton {
  composes: btn btn-ghost from '../../styles/global.css';
  /* component-specific override only if genuinely needed */
}
```

**Design tokens never live in component files.** All `--color-*`, `--font-*`, `--radius`, `--spacing` are declared once in `global.css :root`. Components reference them via `var(--token)`. They never define their own values.

**Duplication in CSS is a bug.** If the same colour value, font size, or transition appears in two component modules, one of them is wrong.

---

## References

The rest of the kit's engineering canon. Read these when this document does not answer the question.

| Document | What it covers |
|---|---|
| [`TESTING_PRINCIPLES.md`](TESTING_PRINCIPLES.md) | Test philosophy, intent-first naming, mocking discipline, failure-mode coverage, flaky-test smells |
| [`PR_WORKFLOW.md`](PR_WORKFLOW.md) | Opening a PR, greening CI, responding to review, design-docs-in-the-same-PR |
| [`BACKLOG_WORKFLOW.md`](BACKLOG_WORKFLOW.md) | How issues come into existence, the Definition of Ready, follow-up filing |
| [`../DOMAIN_SPECIFIC.md`](../DOMAIN_SPECIFIC.md) | Worked examples of these rules applied to one concrete domain |
| [`../templates/ARCHITECTURE.md`](../templates/ARCHITECTURE.md) | The architecture doc your project fills in |
| [`../templates/decisions/DECISION_TEMPLATE.md`](../templates/decisions/DECISION_TEMPLATE.md) | The decision-doc skeleton referenced by "Decision Document Structure" |
