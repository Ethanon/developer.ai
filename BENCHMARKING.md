# Benchmarking plan

**The harness runs locally and is not in this repo.** Only the numbers are published, and they
land in "Results" at the bottom of this file.

Keeping it out is a deliberate trade. A benchmark harness is a corpus fetcher and a model-call loop; it
measures the kit rather than being part of it, and shipping it would put a thousand-call script
in front of every adopter who cloned the repo for engineering principles.

**What it costs: the numbers are not independently reproducible.** Anyone can rebuild the
harness from this document, and the corpus and method below are public and exact, but nobody
can rerun ours by cloning this repo. Any published figure has to say so.

This document holds the method, the settled decisions, and the traps, so the thinking survives
a lost machine even though the code does not.

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

C measures how much of the result comes from the principles.

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

Publish enough that someone else could rebuild it: corpus commit, model, effort, sample seed
and size, the exact prompt each arm assembled, and the count of cases skipped with reasons.
Without those, a reader cannot tell whether the number applies to them.

---

## Settled method

Written down here because the harness that implements it lives outside the repo.

**Three arms per case**, same corpus, same model, same effort. `bare` is the task in one
sentence with no spec. `full` is the agent's spec plus its required reading, as shipped.
`nospec` is the spec with the required reading omitted. **`full` minus `bare` is the headline**,
because it is the only number that says what the kit contributes over the model an adopter
already pays for. `nospec` measures how much of the result comes from the required reading.

**Two directions per CVE.** `introduce` is the inverse diff, a synthetic change that adds the
vulnerability back, and a miss there is a false negative. `fix` is the real patch, where any
finding on the patched lines is a false positive. Scoring both is what catches a model that
learned to flag whatever a diff removes.

**Detection is a file match plus a line proximity**, reported at N of 0, 5, and 20 rather than
at one threshold, so the number stops being an argument about where the line sits. File
matching is by suffix, since an agent may cite `src/a.js` where the corpus says
`packages/x/src/a.js`.

**Sample 30 while developing, the full corpus for anything published.** Thirty cases carries
roughly plus or minus 9 points at 95% confidence, wide enough that a ten-point difference
between arms is not clearly real.

**Cache on the prompt hash**, so rerunning after an unrelated edit costs nothing and editing
one agent's spec invalidates only that agent's arms.

## Traps, found by running it

Both cost a real debugging session and neither is visible in any documentation.

**The GitHub compare API only fills `files[]` when head is ahead of base.** Asking for
`postPatch...prePatch`, which is the `introduce` direction stated directly, returns status
`behind` and an empty file list. That reads as a missing patch rather than a wrong query, so it
looks like corpus rot and silently shrinks the denominator. Always fetch `prePatch...postPatch`
and reverse the hunks to get `introduce`.

**Changelogs hand the agent the answer.** A real diff carried a `HISTORY.md` entry reading
`perf: skip unnecessary parsing of entire header`, and on the `introduce` direction that line
being *removed* is a loud signal the change is a revert. Strip narrative files: changelogs,
readmes, licences, lockfiles.

**Match those names on the whole basename, never as a substring.** A pattern loose enough to
catch `README` also catches `readme-parser.js`, which is a source file, and dropping it shrinks
the corpus without saying so.

## What we do not claim

- **Not a general code-review benchmark.** OpenSSF is security-only. It scores Alice and part
  of Hyde. It says nothing about Bob, Phil, Gomez, or Carl.
- **Not a comparison against commercial tools.** Different corpora, different definitions of a
  finding. Publishing "we beat CodeRabbit" off a corpus they never ran would be dishonest.
- **Not stable across models.** Every number is bound to the model and effort level it ran at.
  Record both alongside the result, or the number rots the first time a default moves.

---

## Results

Nothing published yet. Each entry records the corpus commit, model, effort, sample seed and
size, cases skipped and why, and states that the harness is not public.
