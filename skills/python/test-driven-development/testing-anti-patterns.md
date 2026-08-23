# Testing Anti-Patterns

**Load this reference when:** writing or changing tests, adding mocks, or tempted to add test-only methods to production code.

## Overview

Tests must verify real behavior, not mock behavior. Mocks are a means to isolate, not the thing being tested.

**Core principle:** Test what the code does, not what the mocks do.

**Following strict TDD prevents these anti-patterns.**

## The Iron Laws

```
1. NEVER test mock behavior
2. NEVER add test-only methods to production classes
3. NEVER mock without understanding dependencies
```

## Anti-Pattern 1: Testing Mock Behavior

**The violation:**
```python
# BAD: Testing that the mock was called, not that the page rendered
def test_renders_sidebar(client: FlaskClient) -> None:
    with patch('app.views.sidebar') as mock_sidebar:
        mock_sidebar.return_value = '<div id="sidebar-mock"></div>'
        response = client.get('/')
    assert b'sidebar-mock' in response.data  # testing the mock, not the view
```

**Why this is wrong:**
- You're verifying the mock works, not that the view works
- Test passes when mock is present, fails when it's not
- Tells you nothing about real behavior

**The fix:**
```python
# GOOD: Test real component or don't mock it
def test_renders_sidebar(client: FlaskClient) -> None:
    response = client.get('/')  # don't mock sidebar
    assert response.status_code == 200
    assert b'<nav' in response.data  # test real HTML rendered

# OR if sidebar must be isolated:
# Don't assert on the mock — test the view's behavior with sidebar present
```

### Gate Function

```
BEFORE asserting on any mock element:
  Ask: "Am I testing real behavior or just mock existence?"

  IF testing mock existence:
    STOP - Delete the assertion or unmock the component

  Test real behavior instead
```

## Anti-Pattern 2: Test-Only Methods in Production

**The violation:**
```python
# BAD: destroy() only used in tests
class Session:
    async def destroy(self) -> None:  # Looks like production API!
        await self._workspace_manager.destroy_workspace(self.id)
        # ... cleanup

# In tests
@pytest.fixture(autouse=True)
async def cleanup(session: Session) -> AsyncGenerator[None, None]:
    yield
    await session.destroy()
```

**Why this is wrong:**
- Production class polluted with test-only code
- Dangerous if accidentally called in production
- Violates YAGNI and separation of concerns
- Confuses object lifecycle with entity lifecycle

**The fix:**
```python
# GOOD: Test utilities handle test cleanup
# Session has no destroy() - it is stateless in production

# In tests/conftest.py
@pytest.fixture(autouse=True)
async def cleanup_session(session: Session, workspace_manager: WorkspaceManager) -> AsyncGenerator[None, None]:
    yield
    workspace = session.get_workspace_info()
    if workspace:
        await workspace_manager.destroy_workspace(workspace.id)
```

### Gate Function

```
BEFORE adding any method to production class:
  Ask: "Is this only used by tests?"

  IF yes:
    STOP - Don't add it
    Put it in conftest.py or a test utility module instead

  Ask: "Does this class own this resource's lifecycle?"

  IF no:
    STOP - Wrong class for this method
```

## Anti-Pattern 3: Mocking Without Understanding

**The violation:**
```python
# BAD: Mock breaks test logic
def test_detects_duplicate_server() -> None:
    # Mock prevents config write that test depends on!
    with patch('app.tool_catalog.ToolCatalog.discover_and_cache_tools'):
        add_server(config)
        add_server(config)  # Should raise - but won't!
```

**Why this is wrong:**
- Mocked method had side effect test depended on (writing config)
- Over-mocking to "be safe" breaks actual behavior
- Test passes for wrong reason or fails mysteriously

**The fix:**
```python
# GOOD: Mock at correct level
def test_detects_duplicate_server() -> None:
    # Mock only the slow part, preserve behavior test needs
    with patch('app.mcp_server_manager.MCPServerManager.start'):
        add_server(config)  # config written
        with pytest.raises(DuplicateServerError):
            add_server(config)  # duplicate detected
```

### Gate Function

```
BEFORE mocking any method:
  STOP - Don't mock yet

  1. Ask: "What side effects does the real method have?"
  2. Ask: "Does this test depend on any of those side effects?"
  3. Ask: "Do I fully understand what this test needs?"

  IF depends on side effects:
    Mock at lower level (the actual slow/external operation)
    OR use test doubles that preserve necessary behavior
    NOT the high-level method the test depends on

  IF unsure what test depends on:
    Run test with real implementation FIRST
    Observe what actually needs to happen
    THEN add minimal mocking at the right level

  Red flags:
    - "I'll mock this to be safe"
    - "This might be slow, better mock it"
    - Mocking without understanding the dependency chain
```

## Anti-Pattern 4: Incomplete Mocks

**The violation:**
```python
# BAD: Partial mock - only fields you think you need
mock_response = {
    'status': 'success',
    'data': {'user_id': '123', 'name': 'Alice'}
    # Missing: metadata that downstream code uses
}

# Later: breaks when code accesses response['metadata']['request_id']
```

**Why this is wrong:**
- Partial mocks hide structural assumptions
- Downstream code may depend on fields you didn't include
- Tests pass but integration fails
- False confidence

**The Iron Rule:** Mock the COMPLETE data structure as it exists in reality.

**The fix:**
```python
# GOOD: Mirror real API completeness
mock_response = {
    'status': 'success',
    'data': {'user_id': '123', 'name': 'Alice'},
    'metadata': {'request_id': 'req-789', 'timestamp': 1234567890},
    # All fields the real API returns
}
```

Use a `TypedDict` or `dataclass` for mock responses so the type checker enforces completeness:

```python
class ApiResponse(TypedDict):
    status: str
    data: UserData
    metadata: ResponseMetadata

# Now the type checker errors if you forget a field
mock_response: ApiResponse = {
    'status': 'success',
    'data': {'user_id': '123', 'name': 'Alice'},
    'metadata': {'request_id': 'req-789', 'timestamp': 1234567890},
}
```

### Gate Function

```
BEFORE creating mock responses:
  Check: "What fields does the real API response contain?"

  Actions:
    1. Examine actual API response from docs or a real call
    2. Define a TypedDict or dataclass for the response shape
    3. Include ALL fields the system might consume downstream

  Critical:
    If you're creating a mock, you must understand the ENTIRE structure
    Use TypedDict to let the type checker enforce completeness
```

## Anti-Pattern 5: Integration Tests as Afterthought

**The violation:**
```
Implementation complete
No tests written
"Ready for testing"
```

**Why this is wrong:**
- Testing is part of implementation, not optional follow-up
- TDD would have caught this
- Can't claim complete without tests

**The fix:**
```
TDD cycle:
1. Write failing test (pytest -> FAILED)
2. Implement to pass (pytest -> PASSED)
3. Refactor
4. THEN claim complete
```

## When Mocks Become Too Complex

**Warning signs:**
- Mock setup longer than test logic
- `patch()` nesting three levels deep
- Mocks missing attributes real objects have
- Test breaks when mock changes

**Consider:** Integration tests with real objects (including a real SQLite DB, real filesystem under `tmp_path`) are often simpler than complex mocks.

## pytest-mock vs unittest.mock

Prefer `pytest-mock`'s `mocker` fixture over `unittest.mock.patch` as a context manager. It auto-cleans up after the test and composes naturally with fixtures:

```python
# PREFER (pytest-mock)
def test_calls_external_service(mocker: MockerFixture) -> None:
    mock_call = mocker.patch('app.services.external.call')
    process()
    mock_call.assert_called_once_with(expected_arg)

# AVOID (nesting context managers)
def test_calls_external_service() -> None:
    with patch('app.services.external.call') as mock_call:
        process()
        mock_call.assert_called_once_with(expected_arg)
```

## TDD Prevents These Anti-Patterns

**Why TDD helps:**
1. **Write test first**: Forces you to think about what you're actually testing
2. **Watch it fail**: Confirms test tests real behavior, not mocks
3. **Minimal implementation**: No test-only methods creep in
4. **Real dependencies**. You see what the test actually needs before mocking

**If you're testing mock behavior, you violated TDD**. You added mocks without watching test fail against real code first.

## Quick Reference

| Anti-Pattern | Fix |
|--------------|-----|
| Assert on mock elements | Test real behavior or unmock it |
| Test-only methods in production | Move to `conftest.py` or test utilities |
| Mock without understanding | Understand dependencies first, mock minimally |
| Incomplete mocks | Use `TypedDict`/dataclass, mirror real API |
| Tests as afterthought | TDD: tests first |
| Over-complex mocks | Consider integration tests with `tmp_path` or real SQLite |

## Red Flags

- Assertion checks for `*-mock` markers or mock IDs
- Methods only called in test files
- `patch()` setup is more than 50% of test
- Test fails when you remove the mock
- Can't explain why mock is needed
- Mocking "just to be safe"

## The Bottom Line

**Mocks are tools to isolate, not things to test.**

If TDD reveals you're testing mock behavior, you've gone wrong.

Fix: Test real behavior or question why you're mocking at all.
