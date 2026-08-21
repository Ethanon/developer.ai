# Debugging This Project

<!--
This is a runbook, not a principles doc. The rules live in
engineering/OBSERVABILITY_PRINCIPLES.md; this file holds the commands that
work on YOUR stack.

Fill it in as you debug, not before. A section written from imagination is
worse than no section, because the next reader trusts it.

Sections marked TO FILL cannot be guessed from your wizard answers.
-->

## Where to look first

<!-- TO FILL -->

A decision tree by symptom, so a tired reader does not have to think. One row per
symptom you have actually seen, pointing at the section that resolves it.

| Symptom | Look at |
|---|---|
| _example:_ request returns 500, nothing in the app log | The proxy or gateway layer, below |
| _example:_ request never returns | Timeouts, then the slowest downstream call |
| _example:_ works locally, fails deployed | Configuration and environment, below |

Add a row every time you debug something that took more than ten minutes to locate.

---

## Request path through the stack

<!-- TO FILL -->

Name every hop a request makes, in order, with the component that owns each one.
A reader who knows the path can bisect it. A reader who does not has to guess.

Write it as a list, not a diagram, so it can be scanned:

1. _example:_ client sends request
2. _example:_ edge or CDN terminates TLS
3. _example:_ gateway routes by path
4. _example:_ application handles, authenticates, and queries the datastore

---

## How to read the logs

<!-- TO FILL -->

- Where do logs go in each environment?
- What is the exact command to tail them?
- What is the log format, and how do you filter by correlation id?
- What is the retention, and who else can read them?

Per `OBSERVABILITY_PRINCIPLES.md`, a correlation id should get you from a user report
to the request. Write down the command that does that lookup.

---

## Datastores

<!-- TO FILL -->

For each store: how to connect, how to list what exists, and the one query you always
end up needing. Include the read-only connection string if you have one, because the
2am version of you should not be typing credentials that can write.

---

## Common failure modes

<!-- TO FILL -->

**The most valuable section in this file.** One entry per problem that has already
cost someone an hour. Each entry names the symptom, the actual cause, and the fix.

Format each as: what you see, what it means, what to do.

> _example:_ **The container starts and immediately exits, with no log output.**
> Almost always a missing required environment variable read at module load, before
> the logger is initialised. Run the image with the entrypoint overridden to a shell
> and print the environment.

Add an entry the moment you solve something surprising. If you postpone it, the detail
that made it findable is the part you will forget.

---

## What is not covered here

<!-- TO FILL -->

List the layers you have not personally exercised. A runbook that documents six layers
and stays silent about the seventh reads as though all seven are known.

> _example:_ I have never debugged the message queue under load. The commands below
> are from its documentation, not from an incident, and have not been verified here.

This section is what makes the rest of the file trustworthy.
