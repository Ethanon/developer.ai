# Observability Principles

<!--
`alice_security` and `security_audit` read this alongside SECURITY_PRINCIPLES.md.
Each section carries a tag in an HTML comment near its body:

  tag: Generic
  tag: Architecture-Conditional; applies-when: <condition>

This file holds the RULES for logs, traces, and debugging. What must never reach a
log is in SECURITY_PRINCIPLES.md under "Logging"; this file does not repeat it. Your
own project runbook goes in docs/DEBUGGING.md, built from templates/DEBUGGING.md.
-->

## How to use this document

`SECURITY_PRINCIPLES.md` answers "what must never reach a log." This answers the other
questions: what a log line should contain, how to find one later, and what to do when
the logs are not enough.

The three files divide like this. The security rules protect the subject of the log.
These rules serve the person reading it at 2am. The runbook in `docs/DEBUGGING.md`
tells that person which command to type.

---

## Never Truncate Natural-Language Text

**Is this string prose that a person or a model will read?**
<!-- tag: Generic -->

Then do not cut it short. Never truncate a string before passing it to the logger,
before feeding it to a model, or before writing it to a stored record.

The reasons differ by destination, and all three matter:

- **Logs.** Memory is the logger's problem, not the call site's. A ring buffer, a
  sampling rule, or a retention policy solves it in one place. A truncation at the call
  site solves it nowhere, and destroys the one line you needed.
- **Model input.** If the output is too long for its consumer, change the instructions
  to ask for less. Cutting the result afterwards leaves a sentence ending mid-word, and
  the model never learns.
- **Stored records.** If a record should hold a summary, build the summary on purpose.
  A truncation is a summary that nobody wrote and nobody reviewed.

**What stays.** The ban is on truncating *natural-language text*. These are not
truncation and remain fine:

| Use | Example |
|---|---|
| Array windowing | taking the last three items, or the first twenty results |
| Capitalisation idiom | upper-casing the first character and appending the rest |
| Short-id suffix | the first eight characters of a generated UUID |
| Prefix or index math on a key | stripping a known prefix from a storage key |
| Fingerprinting that reads the whole string | trigram windows for similarity scoring |
| Boundary clamp that rejects rather than trims | a max-length guard mirroring the input field limit |

The last row is worth stating out loud. Clamping a 50,000-character body at the system
boundary is not truncating prose. It is refusing a request that bypassed the interface,
and the honest version returns an error rather than silently keeping the first part.

### The forms a linter cannot see

A rule that matches `.slice` and `.substring` is blind to every other way of taking the
first N characters. Reviewers flag these identically:

- splitting on a separator and taking element zero, including splitting on sentence
  punctuation to take the first sentence
- splitting on spaces, taking N words, and rejoining
- a regex that matches at most N characters, or a replace that drops the tail
- spreading to an array of characters and taking the first N, for a Unicode-aware cap
- a `truncate`, `ellipsize`, or `firstParagraph` helper applied to prose, because
  wrapping a truncation in a function name does not change what it does
- a manual loop appending characters or words until a cap is hit

**The test is what the expression does to the string, not which method it calls.**

---

## A Log Line Is Read by Someone Who Has Lost Something

**Could someone find this line six months from now, and would it tell them anything?**
<!-- tag: Generic -->

- **One event per line, structured.** A log line is a record, not a sentence. Emit
  fields rather than interpolated prose, so the line can be filtered by field later.
- **Carry a correlation id through the whole request.** Every line from one request
  shares an id, and that id is what the caller is shown when something fails. Without
  it, a user report and a log search have nothing in common.
- **Levels mean specific things, and the meanings are written down.** `error` means a
  human must act. `warn` means a human should look if it repeats. `info` is the record
  of what happened. `debug` is for whoever is reproducing a defect. A codebase where
  `warn` means "I was unsure" has no levels at all.
- **Log the decision, not only the outcome.** "Rejected order 41: total 900 exceeds the
  500 limit for tier basic" is debuggable. "Order rejected" is not.
- **Never log inside a tight loop.** Sample, aggregate, or log once at the boundary.

### Retention changes the stakes, not the rule

The security rules on what may be logged do not change when logs leave the machine, but
their consequences do. A rule that protects a file on a developer laptop becomes, in a
hosted log service, a rule protecting a searchable record held by a third party for as
long as retention says. Same rule, higher stakes. Decide retention deliberately, and
write the number down beside the rule.

---

## Rendering Is Not the Call Site's Job

**Am I shortening this for the reader, or for the log?**
<!-- tag: Generic -->

If a debug string is too long to read comfortably, that is a property of whatever
displays it. A developer overlay, a log viewer, or a terminal pager can collapse a long
value and expand it again on demand. The call site does not know which reader it is
writing for and should not guess.

This is "never truncate" stated from the other end. Both exist because the call site is
the one place where the loss is permanent.

---

## Traces Answer "Where Did the Time Go"

**Can I tell which step was slow without adding a log line and redeploying?**
<!-- tag: Generic -->

Logs say what happened. Traces say what happened inside what, and how long each part
took. A system with good logs and no traces can tell you that a request failed, but not
which of its nine downstream calls was the reason.

- **Instrument to a standard rather than inventing span names.** OpenTelemetry semantic
  conventions exist so traces stay portable and the tooling choice stays reversible. For
  agents specifically, see [`AI_AGENT_PRINCIPLES.md`](AI_AGENT_PRINCIPLES.md).
- **A span per boundary crossing**, at minimum: the inbound request, each outbound call,
  each queue hop. Spans inside your own process are optional until something is slow.
- **The correlation id and the trace id are the same conversation.** Given one from a
  support ticket, you should be able to reach the other.

---

## Debugging Beats Guessing

**Have you reproduced it, or are you reasoning about it?**
<!-- tag: Generic -->

The discipline lives in [`ENGINEERING_PRINCIPLES.md`](ENGINEERING_PRINCIPLES.md) under
"Facts Before Fixes", "Follow the Data", "Understand the Root Cause", and
"Troubleshooting Discipline". This file adds only what is specific to observability.

**Write the runbook while you are debugging, not afterwards.** The moment you work out
which command shows the answer, that command belongs in `docs/DEBUGGING.md`. The hour
you just spent is the cost of finding it. The next person should pay nothing.

**Record what you have not verified.** A runbook that documents six layers and stays
silent about the seventh reads as though all seven are known. Name the layers you have
not exercised, so nobody trusts a section that was never tested.

---

## References

| Document | What it covers |
|---|---|
| [`SECURITY_PRINCIPLES.md`](SECURITY_PRINCIPLES.md) | What must never reach a log, redaction, audit-log separation |
| [`ENGINEERING_PRINCIPLES.md`](ENGINEERING_PRINCIPLES.md) | Facts Before Fixes, Follow the Data, Root Cause, Troubleshooting Discipline |
| [`AI_AGENT_PRINCIPLES.md`](AI_AGENT_PRINCIPLES.md) | Tracing agent runs, model calls, and tool executions |
| [`../templates/DEBUGGING.md`](../templates/DEBUGGING.md) | The runbook skeleton your project fills in |
