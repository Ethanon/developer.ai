# What the fleet actually catches

Real output. The agents in `agents/pr-review/` were run against the fixture in
[`fixture/`](fixture/) using their own specs as the prompt, exactly as the production
workflow does it. The comments below are theirs, not a writer's impression of them.

Comments are **excerpted for length** where a reviewer posted more than fits here, and each
section says how many of how many are shown. Wording inside a quoted comment is unedited.

**You can reproduce this.** The fixture is four short files in this repo. Point the same
specs at it and compare.

---

## The fixture

A small billing service: a config module, a rates lookup with a cache, two invoice routes,
and a test file. 76 lines total. Read [`fixture/src/`](fixture/src/) in full if you want to
check the findings yourself; the parts that matter most are these.

```ts
// config.ts
export const config = {
  stripeKey: process.env.STRIPE_KEY ?? 'sk_test_51H8xQ2eZvKYlo2CjkLmNoPqRsTuV',
  dbUrl: process.env.DATABASE_URL ?? 'postgres://localhost:5432/billing',
  ratesApi: 'https://api.exchangeratesapi.io/latest',
}
```

```ts
// rates.ts
const cache = new Map<string, number>()

export async function getExchangeRate(from: string, to: string): Promise<number> {
  const k = `${from}:${to}`
  const hit = cache.get(k)
  if (hit) return hit
  try {
    const res = await fetch(`${config.ratesApi}?base=${from}&symbols=${to}`, {
      signal: AbortSignal.timeout(30000),
    })
    const body = await res.json()
    const rate = body.rates[to]
    cache.set(k, rate)
    return rate
  } catch {
    return 1.0
  }
}
```

```ts
// invoices.ts
invoices.get('/api/tenants/:tenantId/invoices', async (c) => {
  const tenantId = c.req.param('tenantId')
  const rows = await db.invoices.findMany({ tenantId })
  return c.json(rows)
})

invoices.post('/api/tenants/:tenantId/invoices', async (c) => {
  try {
    const body = await c.req.json()
    const rate = await getExchangeRate(body.currency, 'USD')
    const inv = await db.invoices.create({
      tenantId: c.req.param('tenantId'),
      amountCents: Math.round(body.amount * rate * 100),
      currency: body.currency,
      createdBy: body.userId,
    })
    return c.json(inv, 201)
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500)
  }
})
```

---

## Alice — Security

*8 inline comments posted, 5 shown.*

> `config.ts:2` — **Alice:** The `??` fallback is a live-shaped Stripe key
> (`<redacted, config.ts:2>`) committed to the repo, and because it silently works in dev
> nobody notices it's there. SECURITY_PRINCIPLES "Secrets" wants one code path in every
> environment: crash on the missing env var instead of falling back.

Note that she redacts the key in her own comment rather than repeating it, which her spec
requires.

> `invoices.ts:8` — **Alice:** `tenantId` comes from the path, not the session — change the
> number in the URL and you read another customer's invoices. Classic IDOR, and no auth bug
> is needed to exploit it: the caller *is* authenticated, just not for that tenant. Same
> read on line 18 for the write path.

> `invoices.ts:21` — **Alice:** `createdBy: body.userId` is caller-supplied attribution.
> SECURITY.md names "a `userId` in the body" as untrusted by name; as written a client can
> create invoices attributed to any user. Take it from the session context.

> `rates.ts:11` — **Alice:** `from` is `body.currency`, unvalidated, interpolated straight
> into the query string, so a `&` or `#` rewrites the outbound request. It's also the cache
> key on line 16, so arbitrary input grows that map unbounded.

> `rates.ts:15` — **Alice:** `body.rates[to]` is an external API response used directly to
> compute a persisted amount. SECURITY.md puts external APIs on the untrusted side of the
> boundary: check it's a positive finite number before it reaches `db.invoices.create`.

**She also closed with what she deliberately did not flag**, unprompted:

> the `catch { return 1.0 }` fabricated exchange rate in `rates.ts:18` is a failure-policy
> finding that belongs to Bob; the whole of `invoices.test.ts` is Phil's, including the
> undefined `db` reference on line 21; and the hardcoded 30s timeout on `rates.ts:12` is
> Bob's config-module rule, not a security category.

That paragraph is the lane discipline working. She found those problems and left them to
the reviewer who owns them, rather than three agents all reporting the same thing.

---

## Bob — Engineering Principles

*7 inline comments posted, 4 shown.*

His body opened structurally rather than line-by-line:

> `rates.ts` is a free-standing `fetch` imported straight into a route handler, which
> contradicts `examples/decisions/028-client-layer.md` (`Status: Implemented` — "all
> outbound external calls go through a thin client layer"), and its `catch { return 1.0 }`
> contradicts `examples/decisions/037-fail-loud.md` (`Status: Implemented`). Neither
> decision is updated or superseded in this diff.

He went and read the repo's own decision docs, checked their status field, and found the
code contradicting two of them. Nobody told him those files existed; his spec says to read
the design corpus and he did.

> `rates.ts:18` — **Bob:** `catch { return 1.0 }` fabricates a 1:1 rate and the caller
> cannot tell. A rates outage during a billing run persists EUR amounts as USD into
> `amountCents`, and nothing downstream ever learns the number is wrong.

> `rates.ts:14` — **Bob:** no `res.ok` check, so a 500 from the rates API parses as JSON,
> `body.rates[to]` throws, and the failure lands in the catch below and becomes 1.0.

> `rates.ts:12` — **Bob:** `AbortSignal.timeout(30000)` is an inline literal. Per "Timeouts,
> Intervals, and Retries" it belongs in `config.ts` as `config.timeouts.ratesFetchMs` —
> nobody should have to grep for integers to retune this.

> `invoices.ts:19` — **Bob:** Primitive Obsession on money — a float multiply then round,
> with `body.amount` unchecked, so a missing `amount` writes `NaN` into `amountCents`
> without complaint. Take the amount in minor units and convert with integer math inside the
> billing service.

---

## Phil — Testing

*12 inline comments posted, 4 shown.* Phil found the sharpest thing in the whole pass.

> `invoices.test.ts:5` — **Phil:** `vi.mock('./rates')` with no factory auto-mocks
> `getExchangeRate` to return `undefined`. That makes `Math.round(body.amount * rate * 100)`
> evaluate to `NaN` for every invoice these tests create — and both tests still pass,
> because neither one looks at the amount.

Two green tests around a route that computes `NaN`. Nothing else in the pass found that,
and it is invisible unless you reason about what the mock actually returns.

> `invoices.test.ts:13` — **Phil:** `expect(res).toBeDefined()` constrains nothing. The POST
> handler wraps its body in `try/catch` and returns a JSON response on every path including
> the 500, so this assertion holds whether the route succeeded, threw, or was deleted
> entirely.

> `invoices.test.ts:16` — **Phil:** Lonely Test. There's no `beforeEach` and no
> `vi.clearAllMocks()`, so this test's `toHaveBeenCalledTimes(1)` depends on the mock's call
> count *not* carrying over from the test above — which issues the same POST. Run it alone
> with `-t` and it passes, which is the diagnostic.

> `rates.ts:18` — **Phil:** A test named for this path is nearly impossible to write
> honestly — you end up with something like `it('bills at par when the rates API is
> unreachable')`, and reading that sentence back is usually enough to change the design.

His closing line is the one worth keeping:

> I'd genuinely rather see this PR land with zero tests than with these two, because two
> green tests around a route that currently computes `NaN` is worse than an honest gap. The
> gap is visible; the false signal isn't.

---

## Gomez — Clean Code

*8 inline comments posted, 4 shown.*

> `rates.ts:5` — **Gomez:** `getExchangeRate` reads as a pure accessor but it does a network
> fetch and writes the module cache; `get*` naming a side-effecting call is the classic
> name-that-lies. `fetchExchangeRate` or `resolveExchangeRate` tells the caller it may go
> over the wire.

> `rates.ts:8` — **Gomez:** truthiness test on a cached number treats `0` as a miss.
> `const cached = cache.get(cacheKey); if (cached !== undefined) return cached;` says what
> you mean, and `cached` beats `hit` as the noun.

> `rates.ts:14` — **Gomez:** `body` already means "request body" one file over in
> `invoices.ts:15`; reusing it for a fetch response makes the reader track two meanings.

> `invoices.ts:9` — **Gomez:** `rows` is a storage-layer word for what is a list of invoices
> for one tenant. `tenantInvoices`, or plain `invoices` once line 5 stops squatting on it.

He also flagged something outside his lane and said so rather than staying silent:

> Outside my categories, so no inline comment, but it will bite on the first run:
> `invoices.test.ts` calls `db.invoices.create` on line 21 without importing `db`.
> `vi.mock('./db')` registers the mock, it does not bind the symbol.

---

## Hyde — Blackhat Critic

*7 inline comments posted, 3 shown.* Hyde does not list findings; he builds a chain.

> One chain, not seven findings. An authenticated caller picks a currency the upstream does
> not list, the fetch fails or returns `undefined`, `rates.ts` hands back a 1.0 par rate, and
> the invoice persists at a price the attacker chose. Nothing on the POST path validates the
> currency, the amount, or the actor, so the same request also stamps `createdBy` with
> someone else's id. The rate cache never evicts and never hits on a miss, so step one of the
> price attack is also the load attack.

> `rates.ts:18` — **Hyde:** the bare catch does not merely fabricate data, it hands the
> caller the price, because anyone who can force this fetch to fail selects a 1:1 rate and
> the cache finding above shows that forcing it is one bogus currency code away. A 500 KWD
> invoice bills as 500 USD instead of roughly 1,630.

Bob flagged the same line as a failure-policy violation. Hyde flagged it as an attack
primitive. Same line, two different reasons to care, neither redundant.

> `rates.ts:8` — **Hyde:** `if (hit)` treats `0` and `undefined` as misses, and
> `body.rates[to]` is `undefined` for any symbol the upstream does not list, so an unlisted
> currency is never cached and every POST fires a fresh fetch with a 30-second timeout. A few
> hundred concurrent POSTs carrying bogus currency codes pin the outbound socket pool for 30
> seconds each.

> `config.ts:3` — **Hyde:** a missing or mistyped `DATABASE_URL` in production does not
> crash, it silently points billing at a local Postgres, so writes succeed, land nowhere
> real, and nothing surfaces until reconciliation. The `??` is a fail-open, not a default.

---

## What the pass demonstrated

**Four reviewers independently caught a bug nobody planted.** The fixture's test file calls
`db.invoices.create` without importing `db`. That was an accident in writing the fixture,
not a deliberate defect, and Gomez, Phil, Bob, and Hyde all found it, each framing it in
their own terms: Gomez as an out-of-lane courtesy note, Phil as evidence the suite has never
run green, Bob as a structural smell, Hyde as proof the test cannot have passed.

**One finding needed real reasoning.** Phil's auto-mock discovery required simulating what
`vi.mock` returns with no factory, tracing that `undefined` through an arithmetic
expression, and noticing that both assertions are weak enough to pass on `NaN`. No pattern
match gets there.

**The lanes held.** Alice ended her review by naming three findings she deliberately left to
Bob and Phil. Gomez flagged an out-of-lane bug as a note rather than an inline comment. Bob
and Hyde landed on the same line for different reasons and neither restated the other.

**Nobody padded.** Gomez posted eight naming comments on a 76-line fixture, which sounds
like a lot until you read them and find that the file genuinely has eight naming problems.
No reviewer reached for filler.

---

## What they say when there is nothing to say

Carl and Jekyll did not run against this fixture: there is no interface for Carl to review,
and Jekyll critiques other reviewers' findings, which needs a live PR thread. On a real PR
where their categories are empty, their output is one line:

> **Carl** — No user-facing changes in this PR. Deferring.

> **Jekyll** — No notes.

This is the behaviour the kit works hardest to produce. An agent asked to review a diff
will, by default, find *something*. Once an author learns the reviews contain filler, they
skim, and once they skim, Phil's `NaN` finding gets skimmed too.
