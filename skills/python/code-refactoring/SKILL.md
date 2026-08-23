---
name: code-refactoring
description: Code refactoring patterns and techniques for improving code quality without changing behavior. Use for cleaning up legacy code, reducing complexity, or improving maintainability.
source: https://github.com/Ethanon/developer.ai
license: MIT
---

# Code Refactoring

## Refactoring Principles

### When to Refactor
- Before adding new features (make change easy, then make easy change)
- After getting tests passing (red-green-refactor)
- When you see code smells
- During code review feedback

### When NOT to Refactor
- Without tests covering the code
- Under tight deadlines with no safety net
- Code that will be replaced soon
- When you don't understand what the code does

## Common Code Smells

### Long Methods
```python
# BEFORE: Method doing too much
def process_order(order: Order) -> None:
    # 100 lines of validation, calculation, notification, logging...

# AFTER: Extract into focused methods
def process_order(order: Order) -> None:
    validate_order(order)
    total = calculate_total(order)
    save_order(order, total)
    notify_customer(order)
```

### Deeply Nested Conditionals
```python
# BEFORE: Arrow code
def get_discount(user: User, order: Order) -> float:
    if user:
        if user.is_premium:
            if order.total > 100:
                if len(order.items) > 5:
                    return 0.2
    return 0.0

# AFTER: Early returns (guard clauses)
def get_discount(user: User, order: Order) -> float:
    if not user:
        return 0.0
    if not user.is_premium:
        return 0.0
    if order.total <= 100:
        return 0.0
    if len(order.items) <= 5:
        return 0.0
    return 0.2
```

### Primitive Obsession
```python
# BEFORE: Primitives everywhere
def create_user(name: str, email: str, phone: str) -> User:
    if '@' not in email:
        raise ValueError('Invalid email')
    # more validation...

# AFTER: Value objects
from dataclasses import dataclass

@dataclass(frozen=True)
class Email:
    value: str

    def __post_init__(self) -> None:
        if '@' not in self.value:
            raise ValueError('Invalid email')

    def __str__(self) -> str:
        return self.value

def create_user(name: str, email: Email, phone: Phone) -> User:
    # Email is already validated
    ...
```

### Feature Envy
```python
# BEFORE: Method uses another object's data extensively
def calculate_shipping(order: Order) -> float:
    address = order.customer.address
    weight = sum(item.weight for item in order.items)
    distance = calculate_distance(address.zip_code)
    return weight * distance * 0.01

# AFTER: Move method to where the data is
class Order:
    def calculate_shipping(self) -> float:
        return self.total_weight * self.customer.shipping_distance * 0.01
```

## Refactoring Techniques

### Extract Method
```python
# Identify a code block that does one thing
# Move it to a new function with a descriptive name
# Replace original code with the function call

def print_report(data: ReportData) -> None:
    # Extract this block into a function
    _print_header(data)
    # ... rest of report

def _print_header(data: ReportData) -> None:
    header = f"Report: {data.title}\nDate: {data.date}\n{'=' * 40}"
    print(header)
```

### Replace Conditional with Polymorphism
```python
# BEFORE: if/elif on type
def get_area(shape: Shape) -> float:
    if shape.type == 'circle':
        return math.pi * shape.radius ** 2
    elif shape.type == 'rectangle':
        return shape.width * shape.height
    elif shape.type == 'triangle':
        return shape.base * shape.height / 2
    raise ValueError(f'Unknown shape: {shape.type}')

# AFTER: Polymorphic classes
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def get_area(self) -> float: ...

class Circle(Shape):
    def __init__(self, radius: float) -> None:
        self.radius = radius

    def get_area(self) -> float:
        return math.pi * self.radius ** 2

class Rectangle(Shape):
    def __init__(self, width: float, height: float) -> None:
        self.width = width
        self.height = height

    def get_area(self) -> float:
        return self.width * self.height
```

### Introduce Parameter Object
```python
# BEFORE: Too many parameters
def search_products(
    query: str,
    min_price: float,
    max_price: float,
    category: str,
    in_stock: bool,
    sort_by: str,
    sort_order: str,
) -> list[Product]: ...

# AFTER: Parameter object (dataclass or TypedDict)
from dataclasses import dataclass, field

@dataclass
class SearchParams:
    query: str
    price_range: tuple[float, float] = (0.0, float('inf'))
    category: str | None = None
    in_stock: bool | None = None
    sort_by: str = 'relevance'
    sort_order: str = 'asc'

def search_products(params: SearchParams) -> list[Product]: ...
```

### Replace Magic Numbers with Constants
```python
# BEFORE
if user.age >= 18 and order.total >= 50:
    apply_discount(order, 0.1)

# AFTER
MINIMUM_AGE = 18
DISCOUNT_THRESHOLD = 50.0
STANDARD_DISCOUNT = 0.1

if user.age >= MINIMUM_AGE and order.total >= DISCOUNT_THRESHOLD:
    apply_discount(order, STANDARD_DISCOUNT)
```

## Safe Refactoring Process

1. **Ensure tests exist** - Write tests if they don't (`pytest` to confirm they pass)
2. **Make small changes** - One refactoring at a time
3. **Run tests after each change** - `pytest` to catch regressions immediately
4. **Commit frequently** - Easy to revert if something breaks
5. **Review the diff** - Make sure behavior hasn't changed

## Python-Specific Notes

- Use `mypy` or `pyright` for type checking after refactoring: rename regressions show up immediately.
- `ruff` can automate many simple refactors (unused imports, simplifiable conditionals).
- Prefer `@dataclass(frozen=True)` for value objects over mutable classes.
- Use `Protocol` instead of `ABC` when the interface is structural (duck typing): callers don't need to import or inherit from the protocol.
- `functools.lru_cache` / `functools.cache` can replace memoization boilerplate.

## Refactoring Checklist

- [ ] Tests pass before starting (`pytest`)
- [ ] Each change is small and focused
- [ ] Tests pass after each change (`pytest`)
- [ ] Type checker passes (`mypy`/`pyright`)
- [ ] No behavior changes (only structure)
- [ ] Code is more readable than before
- [ ] Commit message explains the refactoring
