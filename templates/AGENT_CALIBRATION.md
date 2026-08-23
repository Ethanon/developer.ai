<!-- Copy to docs/AGENT_CALIBRATION.md and keep it there. This is a living log,
     not a document you finish. Sections marked TO FILL start empty. -->

# Agent Calibration Log

Which findings from the fleet were worth reading, and what was changed as a result.

Reviewer agents are advisory, so nothing forces you to notice one going bad. An agent that
started posting three plausible-sounding non-findings per PR looks exactly like an agent
doing its job, right up until you catch yourself skimming its comments. By then you have
stopped reading the real findings too, and the fleet has quietly become decoration.

This log is the cheapest instrument that catches that. It costs about two minutes per PR.

**Update it when you close a PR, not later.** The judgment you want is the one you made
while the diff was in front of you.

---

## How to grade a finding

Three verdicts, and only three. Resist adding a fourth.

| Verdict | Means | Test |
|---|---|---|
| **signal** | You changed the code, or you would have if it were cheaper. | Would you have wanted to know this before merging? |
| **noise** | Wrong, already decided against, or true but not worth a comment. | Did reading it cost you more than skipping it would have? |
| **judgment** | Defensible either way. You disagreed, but a reasonable reviewer would not. | Could you argue the agent's side without straining? |

Grade the finding, not the wording. An abrasive comment about a real bug is signal.

**`judgment` is not a place to park anything you cannot decide.** If more than about a fifth
of an agent's findings land there, the agent's lane is fuzzy and its spec needs a sharper
statement of what it does not review. That is itself a finding about the agent.

---

## Per-PR entries

One line per finding. Append; never rewrite history, because the trend is the whole point.

| Date | PR | Agent | Finding (5 words) | Verdict | Note |
|---|---|---|---|---|---|
| <!-- TO FILL: 2026-01-14 --> | #<!-- 42 --> | alice_security | tenantId read from path | signal | Real IDOR, fixed in this PR |
| | | | | | |

Delete the example row once you have real ones.

---

## Running tallies

Recount monthly from the table above. Do not maintain these by hand as you go, because a
hand-maintained counter drifts in whichever direction flatters the agent.

| Agent | Findings | signal | noise | judgment | Signal rate | Last spec edit |
|---|---|---|---|---|---|---|
| alice_security | | | | | | |
| bob_engineering | | | | | | |
| phil_testing | | | | | | |
| gomez_cleancode | | | | | | |
| carl_ux | | | | | | |
| jekyll_whitehat | | | | | | |
| hyde_blackhat | | | | | | |

### What the numbers mean

Signal rate is `signal / (signal + noise + judgment)`. Read it against how much the agent
says, not on its own.

- **Above roughly 60%:** healthy. Leave the spec alone.
- **30% to 60%:** tolerable for a broad reviewer such as Gomez, who posts many small
  comments cheaply. Not tolerable for a narrow one such as Alice, whose value is that you
  read every comment.
- **Below roughly 30%:** the agent has drifted. Edit its spec before the next PR, and record
  the edit below.

**A very low finding count is its own signal, and the more dangerous one.** An agent posting
nothing at 100% signal rate may be perfectly calibrated, or may be silently failing. Check
that it actually ran: `finalize-agent-review.sh` exists to make that distinction visible.
See `AGENT_RELIABILITY.md` in the kit.

---

## Spec edits

Every change to an agent's spec, and what prompted it. This is the part that pays back, and
it is the part everyone skips.

Write down what you expected the edit to do. A month later, the tallies say whether it did,
and you will not remember what you were aiming for.

| Date | Agent | What changed | Prompted by | Expected effect |
|---|---|---|---|---|
| <!-- TO FILL --> | | | | |

Six months of this is a specification of what review means on your project, which is worth
more than any of the individual edits.

---

## Standing exclusions

Findings you have decided, once and permanently, that you do not want. Move a rule here
rather than grading the same non-finding as noise every fortnight.

Each entry belongs in exactly one of two places, and putting it in both is how the two
disagree:

- **A project decision** goes in `docs/PROJECT_CONTEXT.md` under "What we don't do." Every
  agent reads it, and it stays true if you swap agents.
- **An agent's lane** goes in that agent's spec, in its own words.

| Excluded finding | Where the rule now lives | Why |
|---|---|---|
| <!-- TO FILL --> | | |

---

## Notes to self

<!-- TO FILL: anything that does not fit a table. Agents that disagree with each other
     regularly, categories nobody covers, findings you wish someone were making. -->
