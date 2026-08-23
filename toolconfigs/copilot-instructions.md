<!--
  Installed at .github/copilot-instructions.md, which GitHub Copilot reads automatically.
  Copilot has no include directive, so this file states the rules it most often breaks
  rather than only pointing elsewhere.
-->

# Copilot instructions

Read `AGENTS.md` at the repo root for the full guide, and the document under
`docs/engineering/` that covers the change you are making.

The rules a completion is most likely to break:

- **The preferred number of lines of code is zero.** Suggest the minimum that solves the
  problem. Do not add options, parameters, or abstractions nobody asked for.
- **Default to zero comments.** Do not annotate what the code plainly does.
- **Never inline a timeout, interval, TTL, or retry count.** They come from the config module.
- **Never fabricate a fallback value** when an operation on the critical path fails. Surface
  the failure.
- **Never widen a type to bypass an error.**
- **Identity comes from the session**, never from a path, body, or query parameter.
- **Names say what a thing is for, not what it is built on.**
- **Tests are deterministic, offline, and fast.** No real network, no real clock.
