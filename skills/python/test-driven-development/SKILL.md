---
name: test-driven-development
description: Use when implementing any feature or bugfix, before writing implementation code
source: https://github.com/Ethanon/developer.ai
license: MIT
---

# Test-Driven Development (TDD)

## Overview

Write the test first. Watch it fail. Write minimal code to pass.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

**Violating the letter of the rules is violating the spirit of the rules.**

## When to Use

**Always:**
- New features
- Bug fixes
- Refactoring
- Behavior changes

**Exceptions (ask the project owner):**
- Throwaway prototypes
- Generated code
- Configuration files

Thinking "skip TDD just this once"? Stop. That's rationalization.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete

Implement fresh from tests. Period.

## Red-Green-Refactor

### RED - Write Failing Test

Write one minimal test showing what should happen.

Good:
```python
def test_retries_failed_operations_three_times() -> None:
    attempts = 0

    def operation() -> str:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise RuntimeError('fail')
        return 'success'

    result = retry_operation(operation)

    assert result == 'success'
    assert attempts == 3
```
Clear name, tests real behavior, one thing.

Bad:
```python
def test_retry_works() -> None:
    mock_op = MagicMock(side_effect=[RuntimeError(), RuntimeError(), 'success'])
    retry_operation(mock_op)
    assert mock_op.call_count == 3
```
Vague name, tests mock not code.

**Requirements:**
- One behavior
- Clear name (`test_<behavior>`, not `test_<function>`)
- Real code (no mocks unless unavoidable)

### Verify RED - Watch It Fail

**MANDATORY. Never skip.**

```bash
pytest tests/test_module.py::test_retries_failed_operations_three_times -v
```

Confirm:
- Test fails (not errors)
- Failure message is expected
- Fails because feature missing (not import errors or typos)

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

### GREEN - Minimal Code

Write simplest code to pass the test.

Good:
```python
from typing import Callable, TypeVar

T = TypeVar('T')

def retry_operation(fn: Callable[[], T], max_attempts: int = 3) -> T:
    for attempt in range(max_attempts):
        try:
            return fn()
        except Exception:
            if attempt == max_attempts - 1:
                raise
    raise RuntimeError('unreachable')
```
Just enough to pass.

Bad:
```python
def retry_operation(
    fn: Callable[[], T],
    max_attempts: int = 3,
    backoff: Literal['linear', 'exponential'] = 'linear',
    on_retry: Callable[[int], None] | None = None,
    exceptions: tuple[type[Exception], ...] = (Exception,),
) -> T:
    # YAGNI
    ...
```
Over-engineered.

Don't add features, refactor other code, or "improve" beyond the test.

### Verify GREEN - Watch It Pass

**MANDATORY.**

```bash
pytest tests/test_module.py -v
```

Confirm:
- Test passes
- Other tests still pass
- Output clean (no warnings, no deprecation notices)

**Test fails?** Fix code, not test.

**Other tests fail?** Fix now.

### REFACTOR - Clean Up

After green only:
- Remove duplication
- Improve names
- Extract helpers

Keep tests green. Don't add behavior.

### Repeat

Next failing test for next feature.

## Good Tests

| Quality | Good | Bad |
|---------|------|-----|
| **Minimal** | One thing. "and" in name? Split it. | `test_validates_email_and_domain_and_whitespace` |
| **Clear** | Name describes behavior | `test1`, `test_foo` |
| **Shows intent** | Demonstrates desired API | Obscures what code should do |

## pytest Specifics

**Fixtures over setup/teardown:**
```python
# GOOD
@pytest.fixture
def user_repo(tmp_path: Path) -> UserRepository:
    return UserRepository(db_path=tmp_path / 'test.db')

def test_saves_user(user_repo: UserRepository) -> None:
    user = User(name='Alice', email='alice@example.com')
    user_repo.save(user)
    assert user_repo.find_by_email('alice@example.com') == user
```

**Parametrize for multiple cases:**
```python
@pytest.mark.parametrize('email', ['', 'notanemail', '@nodomain'])
def test_rejects_invalid_email(email: str) -> None:
    result = validate_email(email)
    assert result.is_err()
```

**Fake time, don't sleep:**
```python
def test_expires_after_ttl(freezer: FrozenDateTimeFactory) -> None:
    cache = Cache(ttl_seconds=60)
    cache.set('key', 'value')
    freezer.tick(61)
    assert cache.get('key') is None
```
Use `freezegun` / `time-machine`; never `time.sleep()` in tests.

## Why Order Matters

**"I'll write tests after to verify it works"**

Tests written after code pass immediately. Passing immediately proves nothing.

**"I already manually tested all the edge cases"**

Manual testing is ad-hoc. No record, can't re-run, easy to forget under pressure.

**"Deleting X hours of work is wasteful"**

Sunk cost fallacy. Keeping code you can't trust is the real waste.

**"Tests after achieve the same goals"**

Tests-after answer "What does this do?" Tests-first answer "What should this do?" Tests-after are biased by your implementation.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Tests after achieve same goals" | Tests-after = "what does this do?" Tests-first = "what should this do?" |
| "Already manually tested" | Ad-hoc is not systematic. No record, can't re-run. |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Keeping unverified code is technical debt. |
| "Keep as reference, write tests first" | You'll adapt it. That's testing after. Delete means delete. |
| "Need to explore first" | Fine. Throw away exploration, start with TDD. |
| "Test hard = design unclear" | Listen to test. Hard to test = hard to use. |
| "TDD will slow me down" | TDD faster than debugging. Pragmatic = test-first. |

## Red Flags - STOP and Start Over

- Code before test
- Test after implementation
- Test passes immediately
- Can't explain why test failed
- Tests added "later"
- Rationalizing "just this once"
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "Keep as reference" or "adapt existing code"
- "Already spent X hours, deleting is wasteful"
- "TDD is dogmatic, I'm being pragmatic"
- "This is different because..."

**All of these mean: Delete code. Start over with TDD.**

## Example: Bug Fix

**Bug:** Empty email accepted

**RED**
```python
def test_rejects_empty_email() -> None:
    result = submit_form({'email': ''})
    assert result['error'] == 'Email required'
```

**Verify RED**
```bash
$ pytest tests/test_form.py::test_rejects_empty_email -v
FAILED: AssertionError: assert None == 'Email required'
```

**GREEN**
```python
def submit_form(data: dict[str, str]) -> dict[str, str | None]:
    if not data.get('email', '').strip():
        return {'error': 'Email required'}
    ...
```

**Verify GREEN**
```bash
$ pytest tests/test_form.py -v
PASSED
```

**REFACTOR**
Extract validation for multiple fields if needed.

## Verification Checklist

Before marking work complete:

- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason (feature missing, not typo or import error)
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass (`pytest`)
- [ ] Type checker passes (`mypy`/`pyright`)
- [ ] Output pristine (no warnings)
- [ ] Tests use real code (mocks only if unavoidable)
- [ ] Edge cases and errors covered

Can't check all boxes? You skipped TDD. Start over.

## When Stuck

| Problem | Solution |
|---------|----------|
| Don't know how to test | Write wished-for API. Write assertion first. Ask the project owner. |
| Test too complicated | Design too complicated. Simplify interface. |
| Must mock everything | Code too coupled. Use dependency injection or pass a Protocol. |
| Test setup huge | Extract fixtures. Still complex? Simplify design. |

## Debugging Integration

Bug found? Write failing test reproducing it. Follow TDD cycle. Test proves fix and prevents regression.

Never fix bugs without a test.

## Testing Anti-Patterns

When adding mocks or test utilities, read [testing-anti-patterns.md](testing-anti-patterns.md) to avoid common pitfalls:
- Testing mock behavior instead of real behavior
- Adding test-only methods to production classes
- Mocking without understanding dependencies

## Final Rule

```
Production code -> test exists and failed first
Otherwise -> not TDD
```

No exceptions without the project owner's explicit approval.
