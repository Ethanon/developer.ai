<!--
  Copy to .claude/calibration/<agent-name>.md, one file per reviewer.

  Each file is appended to that reviewer's prompt at review time, after its spec.
  Appended, not merged into the spec, for three reasons:

    1. The spec is the prompt prefix. Rewriting it weekly busts the cache on every
       reviewer on every PR. Appending at the end does not.
    2. Delete this file and you are back to default behaviour. Undoing spec edits
       is git archaeology.
    3. The file only ever holds calibration, so `git log` on this path is the
       calibration history. No database, no dashboard, no service.

  Write it by hand today. When `calibration_agent` ships, it maintains this file
  and you review its commits instead of typing rows.
-->

# Calibration: `<agent-name>`

What this repo has taught this reviewer. Rules only, in plain language, each with the evidence
that produced it.

**Every entry names the pull requests behind it.** A rule with no evidence is a preference
someone typed once, and it will still be here in a year with nobody able to say why.

---

## Stay silent on

Findings this reviewer keeps raising that this project keeps declining. Not wrong in general;
wrong here.

- **`<the finding, in one line>`**: raised on #NN, #NN, #NN; dismissed each time with no code
  change. `<one sentence on why this project is different>`

<!-- Example:
- **`req.params` reaching a query without validation inside `scripts/`.** Raised on #40, #43,
  #51, #55; dismissed each time with no code change. Those are one-shot maintenance scripts
  run by hand with no untrusted caller.
-->

---

## Raise severity on

The opposite: things this reviewer treats as minor that this project treats as serious.

- **`<the finding>`**: flagged LOW on #NN, fixed immediately and shipped as a hotfix. Treat as
  HIGH here.

---

## Project facts worth knowing

Ground truth that changes a judgment and is not obvious from the diff. Keep it short. Anything
that belongs to the whole project belongs in `docs/PROJECT_CONTEXT.md` instead, where every
agent reads it.

- `<fact>`: `<why it changes this reviewer's judgment>`

---

<!--
  HOW TO DECIDE WHAT GOES HERE

  Grade each finding as you close a pull request, while the diff is still in front
  of you. Three verdicts and only three:

    signal    You changed the code, or would have if it were cheaper.
    noise     Wrong, already decided against, or true but not worth a comment.
    judgment  Defensible either way. You disagreed; a reasonable reviewer would not.

  A finding becomes an entry above when the same one is graded noise three times.
  Three, not one: a single dismissal is usually the finding being right and the
  moment being wrong.

  If more than about a fifth of a reviewer's findings land in `judgment`, its lane
  is fuzzy. That is a finding about the agent, and it belongs in the agent's spec
  under "what you do not review" rather than here.

  A very low finding count is its own signal, and the more dangerous one. An agent
  posting nothing may be perfectly calibrated or silently failing, and those look
  identical. See AGENT_RELIABILITY.md.

  WHAT DOES NOT GO HERE

  A rule you want on every project. That is a spec edit, and it belongs upstream in
  the agent file so every adopter gets it.

  A decision about the project itself ("we don't use ORMs"). That goes in
  docs/PROJECT_CONTEXT.md under "What we don't do", where every agent reads it and
  it survives you swapping reviewers.
-->
