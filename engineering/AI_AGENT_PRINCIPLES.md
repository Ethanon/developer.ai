# AI Agent Principles

<!--
This whole file is tagged `applies-when: ships-llm-prompts`. If the adopter's
project does not build model-calling agents, the installer skips it entirely.

  tag: Architecture-Conditional; applies-when: ships-llm-prompts

Individual sections carry their own tags where they narrow further.

Every rule here is the agent-layer application of "AI Does Fuzzy Logic. Code Does
Deterministic Logic." in ENGINEERING_PRINCIPLES.md. That section draws the line;
this one says what to build on each side of it.
-->

## What this document is for

`ENGINEERING_PRINCIPLES.md` tells you how to build a class. This tells you how to build an agent: a component whose job is to call a model, and which therefore has failure modes a normal class does not have. An agent can be confidently wrong, can quietly forget, and can drift as its context fills. The rules below exist to make those three failures structurally hard rather than a matter of prompt quality.

The single most important rule lives in the other document. It is repeated here because everything else depends on it: **anything with a right answer is code, not a model call.** An agent that computes a total, checks a permission, or resolves a rule inline has already failed, and no prompt fixes it.

---

## Should This Be an Agent At All?

**The question:** _is this task hard to specify in advance, or am I reaching for an agent because agents are interesting?_
<!-- tag: Generic -->

The Prime Directive has a corollary here: **the preferred number of agents is zero.** An agent is the most expensive, least predictable, hardest-to-test component you can add. Reach for it last.

There is a ladder, and you take the lowest rung that works:

1. **No model call.** The task has a right answer. Write the function.
2. **A single model call.** Classification, extraction, summarization, rewriting: one request, one response, no loop. Most "AI features" are this and nothing more.
3. **A workflow.** Multiple model calls in a sequence *your code* controls. You own the branching; the model fills in the steps. Predictable, testable, debuggable.
4. **An agent.** The model decides what to do next and when it is finished. Only when the path genuinely cannot be known in advance.

Before you commit to rung 4, four gates. Any "no" means drop a rung:

- **Complexity.** Is the task multi-step and genuinely hard to specify up front? "Turn this design doc into a pull request" qualifies. "Extract the invoice total from this PDF" does not.
- **Value.** Does the outcome justify the added cost and latency? An agent costs several model calls and seconds-to-minutes where a single call costs one and returns immediately.
- **Viability.** Is the model actually good at this task today? Enthusiasm is not evidence. If you have not seen it work on a hard example, you do not know.
- **Cost of error.** Can a wrong answer be caught and recovered from? Agents fail in ways their authors did not enumerate. If a bad outcome is expensive and undetectable, you need a workflow with checks, not an agent with autonomy.

The failure this section prevents is the most expensive one in the field: building an autonomous loop for a problem that a switch statement and one model call would have solved, then spending months making the loop reliable.

---

## Memory First

**The question:** _does this agent need information from beyond the current scope to produce a correct response?_
<!-- tag: Generic -->

If yes, it queries memory **before** generating, not after and not instead. The agent that says "as you mentioned earlier" without having checked memory is inventing; the agent that queries first and grounds its response in what came back is doing the job. Conversation context is finite; the scope of what a user might reference is not.

- **Never let conversation context grow unbounded.** No accumulating chat history, no "and here is everything that has happened so far" prompts. Context windows fill faster than people expect, and a saturated window degrades model behavior well before it errors. You do not get a warning; you get worse answers.
- **Writing to memory is part of the action loop, not an optional follow-up.** The next turn reads what this turn wrote. Missing writes surface later as the model "forgetting", and that symptom is nearly always a write that never happened rather than a retrieval that failed.
- **Targeted queries, not bulk dumps.** Expose domain-specific reads (`getRecentDecisions`, `getActorSummary`, `getOpenThreads`) and pull the minimum each agent needs. An agent that embeds everything and lets the model sort it out is spending context budget for no gain in signal, and is usually harder to debug than one that asked a narrow question.
- **Retrieval failure is not silent.** If memory is unavailable, the agent says so or fails; it does not generate as though the store returned empty. Empty and unavailable are different states and must not collapse into the same prompt. See "Failure Policy" in [`ENGINEERING_PRINCIPLES.md`](ENGINEERING_PRINCIPLES.md).

### Three levers, not one

"Manage the context" is three distinct mechanisms, and choosing between them is a design decision:

| Lever | What it does | Reach for it when |
|---|---|---|
| **Context editing** | Prunes stale content (old tool results, completed reasoning) from the transcript | Within a session, when old turns are no longer load-bearing |
| **Compaction** | Summarizes earlier context when approaching the window limit | Within a session, when the conversation will otherwise not fit |
| **Memory** | Persists state to a store that outlives the session | Across sessions, when state must survive a restart |

Editing prunes, compaction summarizes, memory persists. Long-running agents commonly need all three. An agent that only has memory will still blow its window mid-session; an agent that only compacts will forget everything the moment the process restarts.

---

## Designing the Tool Surface

**The question:** _what can my harness do with this tool call once the model emits it?_
<!-- tag: Generic -->

The tool surface is the part of agent design that gets least attention and causes most of the operational pain. The model emits tool calls; **your harness** decides what happens next. The *shape* of the call determines what the harness is able to do.

A general-purpose tool (a shell, a query executor, an HTTP client) gives the model enormous reach and gives your harness almost nothing: every action arrives as an opaque string, identical in shape whether it is listing a directory or deleting a database. A dedicated tool gives the harness typed arguments it can inspect, gate, render, and schedule.

**Promote an action from the general-purpose tool to a dedicated one when you need to:**

- **Gate it.** Reversibility is the criterion. Hard-to-reverse actions (sending a message, charging a card, deleting data, deploying) should be confirmable, and you can only confirm what you can recognize. A `send_email` tool is trivially gateable; the same action buried in a shell command is not.
- **Enforce an invariant.** A dedicated `edit_file` tool can reject a write when the file changed since the agent last read it. A shell command cannot express that check.
- **Render it.** Some actions deserve real UI. If asking the user a question is a tool, the harness can render it as a proper prompt with options and block the loop until answered, rather than hoping the user notices a line of text.
- **Schedule it.** Read-only tools can be marked parallel-safe. When every action arrives as an opaque command, the harness cannot distinguish a safe parallel read from an unsafe concurrent write, so it must serialize everything.

**The rule of thumb: start broad, promote on demand.** A general tool first, for reach. Promote to dedicated tools as you discover which actions need gating, checking, rendering, or parallelizing.

### Writing tool descriptions

**The most common tool defect is under-description, not over-description.** This is the one place in this document where the advice is "write more."

- **Describe when to call it, not just what it does.** "Searches the knowledge base" tells the model nothing about timing. "Call this when the question depends on information not present in the conversation, such as current pricing or recent changes" tells it exactly when. Trigger conditions in the description measurably improve should-call rate.
- **Describe every parameter,** including what a valid value looks like and what happens at the boundaries.
- **Say what the tool does *not* do,** and what it does not return. Wrong assumptions about a tool's scope produce failure loops no prompt text can fix.
- **The description is a contract.** If it does not precisely match actual behavior, the model builds a wrong model of your system and follows it consistently.
- **Keep examples out of it.** Worked examples and dialogue snippets in a description cost tokens on every single request and narrow the model's exploration. Make the parameters expressive instead: a well-named enum carries intent for free.

**Tool count is a design constraint.** Past a few dozen tools, loading every schema on every request wastes context and degrades selection. That is the point to reach for dynamic tool discovery rather than adding a forty-first tool to the always-loaded set.

---

## Agent Design Rules

**The question:** _what does this agent need to know, compute, and remember?_
<!-- tag: Generic -->

Answering it honestly forces the shape. Each agent class must:

1. **Accept a typed context object.** A memory snapshot plus the current state it operates on. Not a bag of loose parameters, and not a god object it picks three fields out of (see "Interface Segregation").
2. **Fetch relevant memory before invoking the model.** Per "Memory First" above.
3. **Call deterministic functions for anything computable.** Tool calls, or direct calls into your shared rules package, for every calculation, lookup, roll, and state write. Agents never compute inline. This is the rule that keeps the model out of arithmetic it will get right most of the time and silently wrong the rest.
4. **Return a typed response, never a raw string.** The orchestrator depends on the shape. A raw string forces every caller to parse prose, and prose parsing is where pipelines rot.
5. **Write new memories after acting.** See above: this is half of the loop, not a nicety.
6. **Never share mutable state with a peer agent.** Communicate through memory and typed events only. Two agents holding references to the same mutable object is a data race wearing a costume: one writes, the other reads stale, and the divergence surfaces days later as a correctness bug nobody can reproduce.

**Agents do not contain domain logic.** If an agent method is doing arithmetic, comparing thresholds, or applying a rule, it is in the wrong layer. Extract it to the shared package and call that instead.

**Size budget.** An agent needing more than roughly 50 lines to implement its main entry point is doing too much. Push the work into a focused service and leave the agent thin. The agent's job is to assemble context, call, and hand back a typed result; when it grows past that, it has usually absorbed orchestration that belongs to its caller or logic that belongs below it.

---

## One Agent, One Question

**The question:** _can I state what this agent decides in a single sentence?_
<!-- tag: Generic -->

If the sentence needs an "and", split the agent. This is Single Responsibility applied to a component whose cost of confusion is unusually high: a model given two jobs will trade them off against each other invisibly, and you will not be able to tell from the output which job it shortchanged.

The forcing device is the agent responsibility table required by "Decision Document Structure" in [`ENGINEERING_PRINCIPLES.md`](ENGINEERING_PRINCIPLES.md). Every agent in a pipeline gets a row, and the row has a "question answered" column. A row you cannot fill with one question is the design telling you the agent is doing too much.

A related smell: an agent whose prompt contains the word "also". "Summarize the thread, and also flag anything urgent" is two agents, and the flagging half will be the one that degrades first.

---

## Multi-Agent: Prove You Need It

**The question:** _are these sub-problems genuinely independent, or am I splitting one problem across contexts that need each other?_
<!-- tag: Generic -->

"One Agent, One Question" says how to divide *responsibility*. This says when to divide *execution*, and the answer is less often than it looks. There is real disagreement in the field here, and the disagreement is informative: teams shipping autonomous coding agents report multi-agent systems as fragile, because decision-making disperses and context cannot be shared thoroughly enough between agents. Teams shipping research systems report large gains from parallel agents. Both are right, about different shapes of problem.

**Default to a single agent.** Add a second only when at least one of these genuinely holds:

- **The sub-problems are independent.** Not "separable on a whiteboard": independent in the sense that neither needs to see what the other discovered.
- **Shared context would actively interfere.** Two lines of investigation that would pollute each other's reasoning if run in one window.
- **Wall-clock time matters and the work parallelizes.** Ten documents to read is a real fan-out; ten sequential steps is not.
- **Different sub-tasks need different model tiers.** A cheap model for bulk extraction, an expensive one for the judgment call.

If none apply, you have one agent with a longer context, and that is usually the more reliable system.

**The failure mode to watch for:** a "multi-agent system" where each agent hands its output to the next in a fixed order. That is a workflow, and you should build it as a workflow (rung 3 above), with your code owning the sequence. Calling it multi-agent adds nondeterminism to something that was deterministic.

---

## Prompts Are Code

**The question:** _if this prompt changes, what tells me something broke?_
<!-- tag: Generic -->

Prompts are the least-tested part of most model-calling systems and the part most likely to change under time pressure. Treat them accordingly:

- **Prompts live in version control**, as files, not as string literals assembled across three call sites. One prompt, one file, one name that says what it is for.
- **Response shape is validated, not assumed.** The agent declares the shape it expects and rejects a response that does not match, loudly. Use structured output or tool-use schemas where the provider supports them; validate anyway. A model that returns almost the right shape is the failure this catches.
- **The validator is the agent's contract, not the transport's.** The client that makes the HTTP call is pure transport. It does not know what a valid response looks like; the agent does.
- **Prompt changes get the same review as code changes.** A reworded instruction can change behavior more than a refactor. If your project ships prompt templates, the `prompt_audit` agent scans them for drift.
- **Prompts are per-model artifacts.** A prompt is tuned against one model's behavior. Instructions added to work around an old model's weaknesses become actively harmful on a newer one that no longer has them. Re-audit the prompt surface at every model upgrade; treat the upgrade, not the calendar, as the trigger.

---

## Prefix Stability and Caching

**The question:** _does every turn of this loop resend a prefix that could have been cached?_
<!-- tag: Generic -->

Prompt caching is the cost lever most agent codebases leave unused, and it constrains architecture in ways that are invisible until you measure. Providers cache by **prefix match**: the request is cached from the start up to a marked point, and any byte that changes before that point invalidates everything after it. An agent that loops fifty times resends its whole prefix fifty times, so whether that prefix is stable is close to the whole cost story.

The consequences are architectural, not incidental:

- **Do not change the tool set mid-session.** Tools are rendered at the very front of the request, so adding, removing, or reordering one tool invalidates the entire cache for the rest of the conversation. If you need "modes", do not swap tools: pass the mode as content, or use dynamic tool discovery where the provider supports appending rather than replacing.
- **Do not change models mid-session.** Caches are per-model. Spawning a cheaper sub-agent for a sub-task is fine; switching the main loop's model mid-conversation throws the cache away.
- **Keep the system prompt frozen.** Interpolating anything volatile into it (a timestamp, a session id, a user name, a feature flag) puts a changing byte at the front of every request and defeats caching for everything that follows. Inject that content later in the conversation instead, where it invalidates nothing before it.
- **Serialize deterministically.** Unsorted map iteration, non-deterministic JSON key order, or a tool list built from a set produces different bytes for identical logical content.
- **Forks must reuse the parent's exact prefix.** Summarization passes, sub-agents, and side computations often build their own request. If they reassemble the system prompt or tool list even slightly differently, they miss the parent's cache entirely.

**Verify rather than assume.** Providers report cache hits in response usage data. If the hit count is zero across repeated turns with what should be an identical prefix, something is silently invalidating it, and diffing the rendered bytes between two requests is the fastest way to find it.

---

## Evaluating an Agent

**The question:** _how would I know if a prompt change made this worse?_
<!-- tag: Generic -->

Unit tests with fake model clients prove the plumbing works. They say nothing about whether the agent is any good, and that is the property most likely to regress. Evaluation is a separate discipline from testing, and an agent without it is being changed blind.

- **Build a golden set, and curate it.** A reviewed, versioned collection of representative inputs with expected outputs or expected trajectories. **Quality beats volume by a wide margin:** a hundred carefully constructed cases with precise expectations are worth more than a thousand auto-generated ones with vague ones. Start with your most critical scenarios and grow deliberately.
- **Never edit baseline cases in place.** Add through versions. A golden set you quietly rewrite when it fails is a golden set that can no longer detect regressions.
- **Validate your judge before trusting it.** Using a model to score outputs is standard and works well, but an unvalidated judge measures something unknown. Correlate its scores against human labels on a sample first. If they do not track, you are not measuring quality, you are measuring the judge.
- **Gate deploys on it.** Run the golden set in CI and compare the pass rate against the last passing baseline. Block on a regression beyond a threshold you pick deliberately. This is the same discipline as not merging on red tests.
- **Close the loop from production.** Failure modes discovered in production become permanent golden-set entries, so the same class of failure cannot reach production twice. This feedback loop is what makes the set get better rather than staler.
- **Evaluate the trajectory, not just the answer.** For agents, *how* it got there matters: which tools it called, in what order, how many turns it burned. An agent that reaches the right answer after fifteen redundant tool calls has a defect that output-only scoring cannot see.

Sampling is fine and usually necessary: run cheap deterministic checks on everything, and expensive judged evaluation on a slice.

---

## Failure and Non-Determinism

**The question:** _what happens when the model is unavailable, slow, or wrong?_
<!-- tag: Generic -->

Each of those is a different failure and they do not share a remedy.

- **Unavailable.** Retry per adapter with a bounded attempt count from config. If every retry fails on the critical path, the request fails loudly. See "The layered shape, concretely" in [`ENGINEERING_PRINCIPLES.md`](ENGINEERING_PRINCIPLES.md).
- **Slow.** Timeouts come from the config module, never inline. An agent on a user-facing path needs a timeout shorter than the user's patience, not shorter than the provider's.
- **Wrong shape.** The validator rejects it. Retry with the rejection as context if that is cheap; fail if it is not. Never coerce a malformed response into the expected type.
- **Wrong content.** This is the one you cannot catch at the boundary, and it is why rule 3 above matters so much. Everything with a right answer was computed in code, so the blast radius of a wrong model response is limited to the part that was always going to be a judgment call.

**Non-determinism is a testing problem, and the answer is injection.** The model client is an interface; tests supply a fake that returns fixed responses. Tests never call a real model: they would be slow, flaky, costly, and would silently change behavior when the provider updates. See [`TESTING_PRINCIPLES.md`](TESTING_PRINCIPLES.md).

**Agents that take hard-to-reverse actions need a suspend point, not just a confirmation prompt.** The mature pattern is an interruptible loop with durable state. The agent reaches a gated action, the run checkpoints and suspends, a human approves or rejects, and the run resumes from the checkpoint rather than restarting. That costs real design effort. It is worth it exactly when the "cost of error" gate above was the reason you hesitated.

---

## Cost and Context Budget

**The question:** _will the user ever see the output of this call?_
<!-- tag: Generic -->

If not, do not make it. The common waste patterns:

- **Work computed before a short-circuit.** When a request can be resolved deterministically, check that first and return, rather than generating and then discarding.
- **Context assembled for its own sake.** Every field in a prompt costs tokens and attention. A field nobody has traced to an observable difference in output is a field to remove.
- **Background work on the critical path.** Catch-up generation, summarization, and pre-computation belong in background jobs, not in the synchronous path the user is waiting on.

The opposite mistake is also real: **do not slice or truncate a projection to save context.** Truncation introduces a decision the next reader has to reverse-engineer, and it usually removes the one field that mattered. If growth is a genuine problem, cap at write time where the decision is visible, not at read time where it is not.

**None of this is manageable without instrumentation.** Emit traces for agent runs, model calls, and tool executions. Follow the OpenTelemetry GenAI semantic conventions rather than inventing span names: an `invoke_agent` span with child `chat` spans per model call, and `execute_tool` spans per tool invocation, carrying model, token counts, and finish reason as attributes. The major frameworks and observability vendors already emit and consume those conventions, so following them keeps your traces portable and your tooling choice reversible. Per-call token accounting is also the prerequisite for every optimization above: without it, "this agent is expensive" is a feeling rather than a finding.

---

## References

| Document | What it covers |
|---|---|
| [`ENGINEERING_PRINCIPLES.md`](ENGINEERING_PRINCIPLES.md) | The fuzzy-vs-deterministic split, failure policy, decision-doc structure, SOLID |
| [`SECURITY_PRINCIPLES.md`](SECURITY_PRINCIPLES.md) | The prompt-injection boundary, and why model output re-fed into a prompt is untrusted input |
| [`TESTING_PRINCIPLES.md`](TESTING_PRINCIPLES.md) | Deterministic tests, injection, mocking discipline |
| [`../DOMAIN_SPECIFIC.md`](../DOMAIN_SPECIFIC.md) | A worked agent fleet for one concrete domain |
| [`../agents/audits/prompt_audit.md`](../agents/audits/prompt_audit.md) | The audit agent that scans shipped prompt templates for drift |
