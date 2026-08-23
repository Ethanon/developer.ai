# Benchmarking plan

**Status: planned, not built.** This is the design for measuring whether the reviewer fleet is
actually right, written down so the plan survives a lost session. Nothing here has run yet.

---

## Why this exists

`AGENT_RELIABILITY.md` covers whether an agent **posted**. Nothing covers whether it was
**correct**.

Every commercial peer publishes an accuracy number. Greptile reports an 82% bug catch rate,
Qodo a 60.1% F1, CodeRabbit around 44% with deliberately lower noise. Industry false-positive
rates land in the 5 to 15 percent band. Our entire evidence base is a 76-line fixture and one
gallery of what five agents said about it.

That gap matters more than any missing feature. A kit that tells adopters "a silent agent is a
failed agent" while never checking its own accuracy is open to exactly the criticism it makes
of others.

---

## The experiment that matters

Running Alice against a benchmark produces a number nobody can interpret. Run **three arms
over the same corpus** instead:

| Arm | What runs | What it tells you |
|---|---|---|
| **A. Bare model** | Opus 5, prompt: "review this diff for security issues" | The floor. What you already have without us. |
| **B. Full spec** | Alice's spec plus the principles, as shipped | What the kit produces |
| **C. Spec minus principles** | Alice's spec, no `SECURITY_PRINCIPLES.md` | How much the principles carry |

**B minus A is the only number that matters.** It is what the kit contributes over the model
an adopter already pays for. If it is fifteen points, that is the headline claim and no other
rule kit in the category has one. **If it is zero, that is the most valuable thing we could
learn before publishing**, and we should learn it privately first.

C settles the context-size question with data rather than argument.

---

## Per-agent ground truth

Only one reviewer has a public benchmark. The others have oracles that need no corpus at all,
which is better than building one.

| Agent | Ground truth | Build cost |
|---|---|---|
| **alice_security** | [OpenSSF CVE Benchmark](https://github.com/ossf-cve-benchmark/ossf-cve-benchmark) | Exists. Free. |
| **phil_testing** | Mutation testing (Stryker for JS/TS). A surviving mutant is objectively a test gap. | Low. Fully automatable. |
| **carl_ux** | axe-core WCAG violations, for the accessibility slice | Low, and partial |
| **bob_engineering**, **gomez_cleancode** | Real merged pull requests where a human reviewer left a comment. The human comment is the label. | Medium. Mining, not annotation. |
| **jekyll_whitehat**, **hyde_blackhat** | Measured as a delta: do they raise wave-one precision? | None. Run with and without. |

Build in that order. Alice is free and today. Phil is objective and needs no labels. Bob and
Gomez need mining from public repos with review history. **Carl's non-accessibility half needs
hand-labeling and should be skipped**, because a hand-labeled UX corpus of any useful size
costs more than the answer is worth.

---

## How the OpenSSF benchmark maps onto diff review

It ships 165 usable entries, each with a `prePatch` commit (vulnerable) and a `postPatch`
commit (fixed), a CWE identifier as ground truth, and affected files capped at 1,000 lines. It
is JavaScript and TypeScript, which matches the kit's orientation.

Their tools are SAST scanners that read a whole file. Ours read a diff. The dual-commit
structure is what bridges that, and it bridges it cleanly:

- **`postPatch` to `prePatch`** is a diff that *introduces* a known CVE. That is a faithful
  pull request. Alice should flag it. A miss is a false negative.
- **`prePatch` to `postPatch`** is the real fix. Alice should say nothing. A flag is a false
  positive.

Both numbers come from the same 165 entries. There is a `contrib/` tool-driver mechanism and a
CLI (`bin/cli run --tool <name>`, then `bin/cli report`), with CWE groupings such as
`mitre-cwe-top:25`.

**Caveat worth stating when we publish:** the project is 2020-era with modest commit activity,
so it may under-represent newer CWE classes. Say so rather than letting the number carry more
weight than it earns.

---

## What we report

Catch rate and precision, per arm, per agent. Not catch rate alone: a reviewer that flags
everything scores 100% and is useless, which is the whole reason the peers report F1.

Publish the harness in-repo so anyone can rerun it. **A number nobody can reproduce is
marketing**, and this kit does not get to make that trade after telling adopters to fail a
build on an unverifiable review.

---

## What we do not claim

- **Not a general code-review benchmark.** OpenSSF is security-only. It scores Alice and part
  of Hyde. It says nothing about Bob, Phil, Gomez, or Carl.
- **Not a comparison against commercial tools.** Different corpora, different definitions of a
  finding. Publishing "we beat CodeRabbit" off a corpus they never ran would be dishonest.
- **Not stable across models.** Every number is bound to the model and effort level it ran at.
  Record both alongside the result, or the number rots the first time a default moves.
