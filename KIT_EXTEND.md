# Extending developer.ai

So you've installed the kit, run it for a few weeks, and you want to add a new agent of your own. A repo-specific reviewer ("Karen — accessibility specialist for our public-facing storefront"), a new audit scanner ("license_audit — flags GPL-dependent packages"), or a new backlog automation that fits your team's workflow.

This is the right instinct. The fleet shape — narrow, specialized, named — is meant to grow with the project, not stay frozen at the agents this kit ships with.

## The upstream pattern

Anthropic's own [`cowork-plugin-management/create-cowork-plugin`](https://github.com/anthropics/knowledge-work-plugins/tree/main/plugins/cowork-plugin-management) documents the 5-phase workflow for authoring a Claude Code plugin from scratch. It's the closest thing to canonical guidance on **how to design an agent that holds up over time**.

**Use that workflow as your authoring template.** Don't re-author it here; the upstream version is maintained by the team building Claude Code itself and will stay current with the framework. The 5 phases (paraphrased):

1. **Discovery.** What problem does this agent solve that no existing agent solves? If the answer is "Bob could already do this," extend Bob instead.
2. **Design.** What's the agent's scope, trigger, and output contract? What's it forbidden from doing?
3. **Draft.** Frontmatter + persona + categories + output template. Use one of this kit's existing agents as your structural model.
4. **Trial.** Run it manually for at least a week before automating it. Look for false positives.
5. **Promote.** Wire it into the relevant workflow (`workflows/pr-review.yml` for reviewers, `workflows/scheduled-agents.yml` for audits), update references in `readme.md` and `CLAUDE.md`, and (if it's an audit) add it as a source to `agents/backlog/audit_groomer.md`.

Read the upstream doc end-to-end before drafting your first agent. The hour saved by skipping it is the same hour you'll spend in week 4 unwinding an agent that wasn't scoped tightly enough.

## developer.ai-specific extensions

The upstream Anthropic workflow is generic. A few additions specific to this kit:

### Model the new agent on the closest existing one

Don't draft from a blank file. Pick the agent in this kit whose **shape** is closest to what you're building, and use it as a structural template:

| What you're building | Closest existing agent to model on |
|---|---|
| New PR-review reviewer | `agents/pr-review/gomez_cleancode.md` (single-specialty reviewer, runs on every PR) |
| New whole-PR critic (challenges other reviewers) | `agents/pr-review/jekyll_whitehat.md` or `hyde_blackhat.md` |
| New weekly audit scanner | `agents/audits/security_audit.md` (writes a Markdown report to `.claude/reports/`) |
| New backlog automation | `agents/backlog/scrum_master.md` (lifecycle automation, idempotent operations) |

The structural patterns — frontmatter shape, "what you review", "when to stay silent", "source of truth", "how to post", round-2 taper rules, report templates — are all worth copying directly. Don't reinvent.

### Tag the agent's universality

Inside the frontmatter, add an HTML comment marking how universal the agent is. This kit's installer reads these tags when calibrating an install:

```markdown
<!--
tag: Generic
-->
```

Tag options:

- `Generic` — applies to any codebase. Universal value. Default; safe choice.
- `Architecture-Conditional; applies-when: <condition>` — only useful for projects that have `<condition>` (e.g. `has-frontend`, `has-llm-prompts`, `has-database-migrations`). The installer asks the relevant question and strips the agent if the answer is no.
- `Personal-Preference; default-on` or `Personal-Preference; default-off` — agent is real, but reasonable people disagree on whether to run it. The installer asks.
- `Domain-Specific` — agent only makes sense for one kind of project (e.g. tabletop-RPG mechanics review, ML model evaluation). Adopters in other domains strip it.

If you skip the tag, the installer treats the agent as `Generic` by default. Most agents you build for yourself first will be `Domain-Specific` — that's fine. Tag them honestly so other adopters know to strip them.

### Wire-up checklist

After the agent file lands:

- **PR-review reviewer:** add to the `matrix.agent` list in `workflows/pr-review.yml`. Decide whether it runs in the first wave (alongside Alice/Bob) or the critique wave (alongside Jekyll/Hyde — only if it depends on other agents' findings).
- **Weekly audit:** add a `weekly-<name>` job to `workflows/scheduled-agents.yml` (copy the pattern from any existing weekly job). Add the agent name to the `workflow_dispatch` options. Add the agent as a source in `agents/backlog/audit_groomer.md` if its findings should auto-file as GitHub issues.
- **Daily agent:** add a `daily-<name>` job to `workflows/scheduled-agents.yml`. Same pattern as `daily-developer-agent`.
- **Update `readme.md` fleet list and the Mermaid diagram** so adopters can see the new agent at a glance.
- **Update `CLAUDE.md` headline rules** if the agent enforces something worth a one-line rule.

### Test before you ship to other adopters

If you intend to upstream the agent back to this kit (PRs welcome), trial it for at least four weeks of real PRs in your own repo first. False positives in a reviewer agent cost every adopter trust; an agent that's "mostly right" is worse than no agent.

## When NOT to add a new agent

Three smells that you should extend an existing agent instead of creating a new one:

1. **The new agent's scope overlaps materially with an existing one.** A "TypeScript type-tightness reviewer" overlaps with Bob; absorb it into `bob_engineering.md` as a category, don't ship a sibling.
2. **The new agent fires on the same PRs as an existing one and produces similar-shape findings.** Duplicate noise; the author has to mentally deduplicate.
3. **The new agent's checks could be a lint rule, a typecheck, or a test.** Those have zero per-PR cost; an agent's review burns Claude tokens. Lint rules beat agents whenever the rule is deterministic.

A good rule: **add an agent when the check requires judgment**. A linter can flag `any`; only a reviewer can decide whether the `any` is justified. Phil (unit testing) reviews whether the test name describes intent — a linter can't do that.

## Contributing back

If you build an agent that's genuinely generic and you think other adopters would benefit, open a PR against this repo. Tag it `Generic` and we'll review it through the same fleet that reviews every other PR here — Alice, Bob, Gomez, Carl if it's user-facing, plus Jekyll and Hyde on the critique pass. Advisory review only; you decide what to act on.

See `engineering/PR_WORKFLOW.md` for the full PR lifecycle this kit uses.
