---
name: parallel-sessions
description: How to keep several agent threads from colliding when each one starts a long-running process such as a dev server, a database, an emulator, or a browser profile. Covers the triage for "am I looking at my own output", the mechanism for giving every checkout its own ports and its own names, and the Windows path limit that makes worktrees undeletable.
source: https://github.com/Ethanon/developer.ai
license: MIT
---

# Parallel Sessions

`PR_WORKFLOW.md` puts every thread in its own worktree. That stops threads overwriting each other's *files*. It does not stop them overwriting each other's *processes*. The moment a thread starts a dev server, a database, an emulator, or a headless browser, it competes for a fixed port and a fixed name with every other thread on the machine.

That collision is worse than the file one, because it does not fail. The second bind loses, the first process keeps answering, and the losing thread reads another branch's output as its own. What that looks like in practice is a green test run against code that was never loaded, or a screenshot of a screen that does not exist in your source.

## Triage: am I looking at my own output?

Run these before believing a screenshot, a log line, or a bug report. They are in rough order of how often each turns out to be the answer.

1. **Ask what this checkout thinks it owns.** Use whatever your project has for reporting its own state, or read the file the port was written to. If it names the default port and you are in a worktree, the tooling does not know you are in one. Skip to item 4.
2. **Ask the running process which branch it is serving.** Request something only your branch has: a symbol in a bundle, a route that does not exist on the default branch, a version string. Something answering on the port is not the same as *your* thing answering.
3. **Ask the machine who else is up.** List the processes or devices and check how many are candidates. A second one belonging to another thread is normal. A second one on *your* name is not.
4. **Check the worktree is somewhere the tooling recognises.** This is the silent one. When identity is derived from the directory path, and it should be, a worktree placed outside the recognised directories resolves to the *main checkout's* identity and shares its ports with whoever else is there.

Design against that fourth case explicitly, because it is invisible from inside the session. Git already knows the answer. A worktree's `.git` is a *file* naming the real git directory, while a checkout's `.git` is a *directory*. When git says worktree and your path convention says otherwise, print that in the status output rather than leaving it to be discovered.

## The mechanism

Derive identity from the checkout's own directory. Do not keep a registry of which thread holds which port. A registry has to be cleaned up when a session dies, and sessions die.

**Give every checkout a slot, and move all of its ports together.** If a project serves on 3000, 5432 and 8080, then slot 1 serves on 3100, 5532 and 8180. One offset is applied to every port at once, so a checkout's ports share a prefix and a human reading `5532` knows whose it is.

Moving them together matters because independent scans overlap. Give each service its own range and the ranges collide with each other. A port that one service has claimed but not yet bound reads as free to the next service's scan, so a checkout can double-book itself. A single offset makes that arithmetically impossible.

**Take a slot by creating a file exclusively, not by checking and then writing.** This is the part that is easy to get wrong and hard to notice:

```
probe the ports        ← both threads see them free
write the claim        ← both threads write
```

Two threads starting in the same millisecond both pass the probe. The window is small, and it is exactly the case the scheme exists for. Use an exclusive create on a per-slot file in the shared repository root: `O_EXCL`, which is `{ flag: 'wx' }` in Node and `open(..., 'x')` in Python. Only one creator can win. The create has to happen *before* the first `await` in the claim path, not after it.

Then keep three rules straight.

- **A slot you already hold is kept, whatever is listening on it.** Your own server answering on your own port is the normal case. Re-probing liveness and reading a busy port as proof the slot was lost will push a session off its own ports mid-run.
- **A slot you are newly taking has to be clear of everything**, including processes that have nothing to do with your project.
- **A slot whose owner is no longer on disk is free.** That owner is a removed worktree. This is how the register cleans itself up without anybody sweeping it.

**Probe by connecting, not by binding.** On Windows, `SO_REUSEADDR` is the default, so a second bind to a port another process is already listening on *succeeds*. A refused connection is the only answer that means nobody is home. Treat a timeout as occupied rather than free.

**Name every other shared resource the same way.** Anything else a thread starts and could collide on gets the checkout's name appended: an emulator or VM image, a container, a database, a browser profile directory. A teardown command can then stop what *this* checkout started and leave the rest alone, which is what makes it safe to run at all.

`workspace.mjs` in this directory implements all of the above in about 170 lines with no dependencies. Port the shape rather than the file.

## Recognise a worktree whichever tool made it

Different AI tools put worktrees in different places: `.claude/worktrees/`, `.codex/worktrees/`, or a plain `.worktrees/`. If your identity function matches only the directory your primary tool uses, every worktree made by a second tool reads as the main checkout. Same ports, same emulator, same database, no warning. Match all of them, and add new spellings as tools appear.

The same asymmetry bites dependency linking. An agent harness that links dependencies into worktrees it creates does nothing for worktrees a different tool created, because that tool never read the first tool's configuration. Put the link in the package manager's pre-install step, where it runs regardless of who made the directory.

## Windows: the 260-character limit

Two switches, both needed, both idempotent. Setup should assert them rather than a document describing them.

| Switch | Scope | Privilege | Covers |
|---|---|---|---|
| `git config core.longpaths true` | one repository | none | git's own operations: `worktree remove`, `clean`, `checkout` |
| `LongPathsEnabled=1` under `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem` | the machine | administrator | everything else: package managers, build tools, your own scripts |

Setting only the first leaves your package manager failing on paths git now handles, which reads as a broken install rather than a path limit.

**Prompt for the elevation only when a human is at the terminal.** Check for a TTY, and report the one-line fix otherwise. A UAC dialog raised inside an agent's shell is a command that never returns.

The failure all of this prevents: a worktree that installed its own dependency tree sits at a path deep enough that Windows will not delete it. `git worktree remove` then fails with `Filename too long` after it has already unregistered the worktree, and the directory stays until somebody finds the incantation.

## What this does not replace

The rule that every thread starts in a worktree belongs in your always-loaded steering document, not in this skill. A skill loads when its description matches the task at hand, and the case that breaks that is a session which begins as a question and ends as a change. Most sessions do. Keep the invariant always-on, and use this skill for the mechanism and the triage behind it.
