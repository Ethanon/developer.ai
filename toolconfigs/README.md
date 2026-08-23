# Tool configuration

Config files for the AI coding tools that read a repo's rules automatically. The installer
writes the ones the adopter asks for, and defaults to all of them so a mixed team is covered.

| Tool | Source file | Installs as | Format notes |
|---|---|---|---|
| (shared spine) | `AGENTS.md` | `AGENTS.md` | Read natively by Codex and several others. Every file below points at it. |
| Claude Code | `CLAUDE.md` | `CLAUDE.md` | Plus the specs in `.claude/agents/`. |
| OpenAI Codex | (the spine) | `AGENTS.md` | Its native file already. Nothing extra to write. |
| Cursor | `cursor.mdc` | `.cursor/rules/developer-ai.mdc` | MDC frontmatter. `alwaysApply: true` puts it in every request. |
| GitHub Copilot | `copilot-instructions.md` | `.github/copilot-instructions.md` | No include directive, so this one restates the rules rather than only pointing. |
| Gemini CLI | `GEMINI.md` | `GEMINI.md` | |
| Windsurf | `windsurf.md` | `.windsurf/rules/developer-ai.md` | `trigger: always_on` frontmatter. |
| Kiro | `kiro-steering.md` | `.kiro/steering/developer-ai.md` | `inclusion: always` frontmatter. |

## Why a spine plus pointers

Writing the rules into seven files produces seven files that disagree within a quarter. The
first person to fix a rule fixes it where they happened to be looking, and the other six keep
teaching the old one. Nothing catches it, because no tool reads more than its own file.

So `AGENTS.md` holds the text and everything else points at it. `AGENTS.md` earns that job by
being the file the most tools already read without being told.

**Copilot is the exception, and it is a deliberate one.** It has no way to include another
file, so its instructions restate the rules a completion is most likely to break rather than
pointing at a document it will not open. That duplication is real, and it is the reason its
file lists only the rules that survive being stated without context.

## Editor tools and CI are separate questions

The files here configure whatever tool a person has open. They do not decide what runs in the
pipeline.

The reviewer and audit agents run Claude Code in CI, because that is what the runner action
is. A team writing code in Cursor and Kiro still gets Claude reviewers on its pull requests,
and nothing about that is a conflict. The specs in `.claude/agents/` are plain markdown; the
directory name is Claude Code's requirement, and any tool can read the files.

## Adding a tool

1. Write the config file here, named for the tool.
2. Make it a pointer to `AGENTS.md` unless the tool cannot include another file.
3. Add a row to the table above with its install path and any frontmatter it needs.
4. Add it to the installer's tool list in `agents/installer.md`, Q0b.

Keep the pointer short. A pointer that grows into a second copy of the rules is the problem
this layout exists to avoid.
