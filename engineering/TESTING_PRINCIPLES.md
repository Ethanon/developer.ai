# Testing Principles

<!-- tag: Generic -->

The single source of truth for how this project writes, names, and reviews tests. The unit-testing reviewer agent (`phil_testing`) enforces these rules at PR time; the weekly audit agent (`flaky_test_finder`) enforces them retrospectively across the test suite. Both agents read this file; the principles never live in two places.

If you change a rule here, neither agent needs editing — they pick up the change on next run.

---

## The philosophy

Tests are not a safety net under code that already exists. **Tests are the specification of what code is supposed to do, written before the code, in the language of how callers will use it.**

The test is where:

- The method's name gets decided.
- The shape of the parameters gets decided (positional vs object, required vs optional, defaults).
- The failure modes get thought through (what can go wrong, what the caller should see when it does).
- The contract gets locked in (what observable outcome the caller depends on).

Code that follows the test is the second thing you write, not the first. A test added after the code already exists almost always tests the implementation that's already there, not the behavior the system is supposed to have.

---

## What we mean by "smell"

A **smell** is a structural pattern in code that suggests a deeper problem, even if nothing is currently broken. The term comes from Martin Fowler's *Refactoring* (the original "code smell" taxonomy — long methods, feature envy, primitive obsession, shotgun surgery) and Gerard Meszaros's *xUnit Test Patterns* (the "test smell" taxonomy — fragile test, obscure test, mystery guest, eager test, conditional test logic).

A smell is not necessarily a bug. The test passes. The function returns. But the smell predicts that something will break later: the test will become flaky under load, the test will become useless to the future reader, the code under test will resist refactoring, a maintainer will misread the intent and introduce a regression. The point of naming smells is to give reviewers a shared vocabulary for "this works today, but I have seen this exact shape cause pain three times already."

This document calls out two categories of test smell:

- **Flakiness-predicting smells** — structural patterns that predict the test will fail intermittently. The `flaky_test_finder` audit scans for these weekly; `phil_testing` catches them at PR time.
- **Structural test smells** — patterns from Meszaros's taxonomy that predict the test will be brittle, obscure, or useless to its future reader, even if it never flakes. Phil scans for these at PR time.

Both categories are listed in detail below. When you flag one, name it explicitly ("Mystery Guest" / "smell #4 — inline hook timeout") so the author can look it up.

---

## Deterministic, offline, fast

Every test must be all three. A flaky or slow test is a broken test; it poisons the CI signal and trains everyone to ignore failures. Flakiness is a P1 bug — higher priority than most features.

- **Deterministic.** Same input, same output, every run, regardless of clock, randomness, network conditions, or test ordering.
- **Offline.** No real network. No real disk. Mock at the boundary: `fetch`, the database client, the model client, the filesystem. Unit tests never hit Postgres, Redis, an actual disk, or a real external API.
- **Fast.** Individual test under 500ms wall-clock. Full suite under 10 seconds (or whatever budget the project sets in `PROJECT_CONTEXT.md`). If a test exceeds the per-test budget, it is a smell — check for real waits or heavy setup.

Integration tests that need a real service are a different tier and gated separately; nothing in the default unit-test run touches the network.

Additional invariants:

- **Isolation.** Each test owns its setup; no shared mutable state between cases. Reset mocks (`vi.clearAllMocks()`, `jest.clearAllMocks()`, equivalent) before every test.
- **Test the contract, not the implementation.** Assert on observable behavior (return values, emitted events, recorded mock calls), not on internal state shape. Refactors that keep the contract should keep the tests green.
- **Fake timers, always.** If the code under test uses `setInterval` / `setTimeout` / `Date.now()`, the test uses fake timers.

A test that only passes "sometimes" is not a test. Fix the flakiness or delete it. There is no third option.

---

## Intent-first naming

Test names, fixture names, and the method names the tests are exercising all communicate intent. For the general naming conventions that apply to all code in this project, see [`ENGINEERING_PRINCIPLES.md` → "Naming Conventions — Suffixes Are Contracts"](ENGINEERING_PRINCIPLES.md). Test code has three additions:

### Test names describe behavior

The test name is read in the failure output. It must tell a reader "what was the system supposed to do?" in one sentence.

| Bad | Good |
|---|---|
| `it('works')` | `it('returns null when the cart is empty')` |
| `it('test_apply_coupon_returns_correct_amount')` | `it('charges the larger of the two coupon amounts when both apply')` |
| `it('calls applyCoupon')` | `it('applies the coupon discount before tax, not after')` |
| `it('test_1')` | `it('rejects a coupon code longer than 50 characters')` |

The pattern: **subject + behavior verb + condition.** "The cart's total drops to zero when every item is refunded." Skip "should" — "the cart's total drops to zero" is stronger than "should drop to zero."

### Method names under test describe what, not how

The test is also where the public API of the method gets named. If the test reads `processData(input)`, the method's name is too vague — the test will not help a future caller understand what they get. Push back to a behavior-bearing name like `summarizeInvoicesByCustomer(invoices)`.

### Parameters that read as usage

The call site in a test is documentation. If a test does `applyCoupon(100, [c1, c2])`, the method's parameter shape is already a future debugging headache. If it does `applyCoupon({ subtotal: 100, coupons: [tenDollarOff, tenPercentOff] })`, the call site reads as itself.

Rules:

- **Object parameters when there are more than three.** `createUser('Alice', 'alice@x', 25, false, null)` is the call site of a method that's already wrong.
- **Named options instead of raw booleans.** `sendEmail(user, message, true)` — what's `true`? Use `{ sendImmediately: true }`.
- **Fixture builders with named overrides.** `makeUser({ isAdmin: true })` beats `makeUser(null, null, null, true)`. Minimal-default fixtures (`makeUser()` returns the smallest viable user) keep test intent visible; kitchen-sink defaults bury it.

---

## Mocking discipline

Mock at the **boundary** — the network adapter, the database client, the clock, the random-number generator — not at every internal function call. Two failure modes, both worth catching:

### Over-mocking — the test is testing the mocks, not the code

- More mock setup lines than assertion lines: smell.
- Mocks of internal collaborators (functions in the same module): smell. Internal collaborators are part of the unit; mocking them tests the mock framework, not the code.
- Mocks of pure functions: smell. A pure function IS its return value; mocking it adds no value over passing the value directly.
- **Diagnostic:** if the test passes when the production code is deleted, the test is testing nothing.

### Under-mocking — the test hits real systems

- Real network connections, real database connections, real file I/O without an explicit "this is an integration test" annotation: forbidden in the default unit-test run.
- Wall-clock time (`Date.now()`, real `setTimeout`): use fake timers.
- System randomness without a seed: inject the RNG, mock it, or pass a seed.

Match the project's chosen mocking conventions over generic best practice. Some projects mock at module boundaries; some inject dependencies; some use real fakes (an in-memory DB). Read 2-3 existing tests in the area to learn the local pattern.

---

## Failure-mode coverage

For every happy-path test on a function that can fail, at least one failure-mode test. The happy path was the easy part of the design; the failure modes are where the code's contract gets revealed.

Common failure modes a unit test should cover when realistic for the code under test:

- **Network / external service:** timeout, 4xx response, 5xx response, connection refused, retry-after-failure.
- **Validation:** missing required field, invalid format, out-of-range value, type mismatch.
- **Permission:** caller lacks rights, resource forbidden, expired credential.
- **Race conditions:** concurrent calls to the same resource, repeated invocations, retry storms.
- **Edge values:** empty input, single-element input, max-size input, null, undefined, zero, negative.

Don't demand every failure mode on every function. Demand the ones the production code's `throw` statements, `if (!x)` checks, or external-call call sites imply are reachable.

A function that has happy-path-only tests is a function whose failure handling was never thought through.

---

## Behavior bundling — one behavior per test

Three patterns to avoid:

- **Multiple behaviors crammed into one test.** A test titled `it('handles the full checkout flow')` that exercises 8 separate behaviors is a refactoring test, not a unit test. When it fails, the author has to re-read the whole test to figure out what broke. Split into one test per behavior.
- **One assertion per test, split arbitrarily.** A test that asserts only `expect(result).toBeTruthy()` and a sibling test that asserts only `expect(result.id).toBe('x')` — both belong in one test, because they describe the same behavior. Merge.
- **Setup repeated across every test in a describe block** when a `beforeEach` would express the shared state once. Extract.

The principle: **one behavior per test, multiple assertions per behavior.** A "behavior" is a single observable outcome the caller depends on. A behavior often requires multiple assertions to fully characterize (the return value, the side effect, the emitted event); those belong together because they describe the same thing.

---

## AAA structure

Tests read as three blocks separated by blank lines: **arrange, act, assert.**

```
// Arrange
const cart = makeCart({ subtotal: 100 });
const coupon = makeCoupon({ percentOff: 10 });

// Act
const result = applyCoupon(cart, coupon);

// Assert
expect(result.discountedTotal).toBe(90);
```

Smells:

- **Interleaved setup and assertion** ("call A, expect X, then call B, expect Y, then call C"): the test is exercising multiple behaviors — see "Behavior bundling" above.
- **No clear Act step** (the function under test is buried in a chain of setup helpers): the reader can't tell what's being tested. Make the call to the unit under test visible as its own line.

---

## Test smells

The smell taxonomy this project enforces. Two categories: flakiness-predicting smells (which predict the test will fail intermittently) and structural smells (which predict the test will become brittle, obscure, or useless to its future reader, even if it never flakes).

### Flakiness-predicting smells

These are the structural patterns that predict flakiness even without CI history of an actual failure. The `flaky_test_finder` audit scans for all of them weekly; `phil_testing` flags them at PR time when introduced in a diff. Ordered by confidence the smell will actually produce flakes.

#### HIGH-confidence smells — very likely to cause nondeterminism

1. **Real timer sleeps without fake timers.** `await new Promise(resolve => setTimeout` or `await sleep(` inside a test body, when the enclosing file does NOT call `vi.useFakeTimers()` / `jest.useFakeTimers()` / equivalent. Explicit real-time wait — always flaky under load.

2. **`Date.now()` or `new Date()` in assertions.** Any `expect(...)` whose expression contains `Date.now()`, `new Date()`, or `.toISOString()` directly (not via a pre-captured variable). Time-dependent assertions flake when the clock ticks between setup and assertion.

3. **Real network calls.** `fetch(` or `axios.` in a test file that does NOT import a mock for it (no `vi.mock` / `jest.mock` for a fetch-adjacent module, no `msw` setup). Calls real services which are unavailable in CI and slow when they are available.

4. **Inline timeout literals in `beforeEach` / `beforeAll`.** `beforeEach(fn, <literal number>)` — if the number is the second arg, it overrides the global `hookTimeout`. Values under 5000ms are especially risky under CI load.

#### MEDIUM-confidence smells — likely to cause ordering-sensitive failures

5. **Shared mutable module-level state without reset.** A `let` or `var` declared at module level in a test file that is NOT reset in a `beforeEach`. If multiple tests in the file mutate this variable, test ordering can affect outcomes.

6. **`Math.random()` in test assertions.** Any `expect(...)` whose expression uses `Math.random()` directly. Non-deterministic assertions flake by definition.

7. **`Object.keys()` or `Object.entries()` in ordered assertions.** `expect(Object.keys(...)).toEqual([...])` — key order is implementation-defined and has changed between runtime versions. Use `.toContain()` or sort first.

#### LOW-confidence smells — worth noting but often acceptable

8. **`setTimeout` / `setInterval` literals outside `config`.** Inline numeric delays (not reading from a config module) in test setup code. Violates the "Timeouts and intervals never inline" rule in [`ENGINEERING_PRINCIPLES.md`](ENGINEERING_PRINCIPLES.md) regardless of fake vs real timer use.

9. **`process.env` reads in tests without a mock.** Test behavior that changes based on real env state can differ between local and CI.

For each smell, check context (3 lines around it) to determine whether a mitigating pattern (fake timers, a `vi.mock`, a comment explaining the exception) is present before flagging.

### Structural test smells

Patterns from Meszaros's *xUnit Test Patterns* taxonomy that predict the test will be brittle, obscure, or useless to its future reader. The test passes today, but the smell predicts a maintenance failure later. Phil scans for these at PR time.

Several Meszaros smells are addressed elsewhere in this document and not repeated here: **Eager Test** (multiple behaviors per test → see "Behavior bundling"); **Obscure Test** (unclear arrange/act/assert → see "AAA structure" and "Intent-first naming"); **Test Code Duplication** (repeated fixtures → see "Test-utility shape"); **Fragile Test** (asserting on internals → see "Test the contract, not the implementation" under "Deterministic, offline, fast"); **Erratic Test** (passes sometimes → see "Flakiness-predicting smells" above). The four below are the ones that don't fold cleanly into the other sections:

10. **Mystery Guest.** The test depends on data that isn't visible in the test body — a fixture file path the test loads, an environment variable the test reads, a row in a shared test database the test assumes exists, a snapshot file the assertion compares against. The reader has to dig elsewhere to understand what the test is actually exercising. Fix: inline the data into the test, or use a fixture *builder* (`makeUser({...})`) whose call site shows the relevant fields.

11. **Conditional Test Logic.** `if`, `for`, `while`, `try/catch`, ternaries inside the test body. The test has its own control flow. Two failure modes: (a) the test branches, so it's really N tests pretending to be one — failure tells you "something failed" but not which branch; (b) the test loops, so failure points at "iteration 7" with no context on what's different about iteration 7. Fix: parameterize via `it.each` / `describe.each` / equivalent so each case is its own named test. The one near-exception: `try/catch` around the *act* step to assert on a thrown error, but most frameworks offer `expect(...).toThrow()` which is cleaner.

12. **Hard-Coded Test Data without labels.** `expect(result.total).toBe(187.45)`. Where does 187.45 come from? If it's not derived in the arrange block (`const expectedTotal = (subtotal + tax) * (1 - discountRate)`) or named as a constant (`const EXPECTED_PRO_RATED_TOTAL = 187.45`), the reader can't tell whether 187.45 was the right answer or just what the code returned the first time the developer ran the test. Fix: derive expected values from the inputs where the relationship is obvious, or name them with intent.

13. **Lonely Test.** A test that depends on another test having run first — usually via shared state (module-level variables, persisted test DB rows, accumulated mock state). The test passes when the suite runs in order; it fails when run in isolation or when the suite ordering changes. Diagnostic: run the test on its own (`vitest run path/to/file.test.ts -t "the test name"`). If it fails alone but passes in the suite, it's lonely. Fix: move shared setup into `beforeEach` so each test owns its starting state.

For each structural smell, the same rule applies as for flakiness smells: check the surrounding context for a mitigating pattern or comment explaining the exception before flagging.

---

## Test-utility shape

Test fixtures, builders, and helpers obey the same intent-first naming rules as production code.

- **Minimal-default factories** — `makeUser()` returns the smallest viable user; tests that need more set it explicitly. A `makeUser()` that returns a kitchen-sink user with every field populated buries the test's actual intent ("with admin set to true") in a wall of irrelevant defaults.
- **Named-parameter overrides** — `makeUser({ isAdmin: true })` beats `makeUser(null, null, null, true)`.
- **Don't repeat large fixture blocks across tests.** Extract.
- **Helpers do one thing.** A helper named `setupCheckout()` that mutates four globals, mocks three modules, and asserts something is not a helper — it's a hidden test body. Tests should be readable without diving into helpers.

---

## When to deviate

Project-specific patterns in `PROJECT_CONTEXT.md`, a project-specific `TESTING.md`, or established conventions in the existing test suite override the generic rules here. Consistency with the local pattern beats generic best practice; the agents respect that.

If you find yourself adding an exception, explain why in a comment in the test file. A future reader (or audit agent) will know it's deliberate, not drift.
