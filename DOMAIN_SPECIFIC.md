# Domain-Specific Patterns

This file collects patterns from a real production project (a turn-based AI-driven role-playing game) that don't generalize cleanly to every adopter. They're here because the kit's generic rules in `engineering/ENGINEERING_PRINCIPLES.md` sometimes point at one of these patterns as the worked-out version — read the section that matches what you're building; skip the rest.

If your project is a CRUD web app, an e-commerce store, a SaaS dashboard, or any other "users do CRUD on records" shape, none of this applies. Close the file; the generic rules cover you.

---

## Turn-based state machine with typed delta operations

*Generalises: "state mutations go through a single delta helper, never spread-and-replace" — see `engineering/ENGINEERING_PRINCIPLES.md` → "State Mutations" and "Testing".*

A turn-based game has a large nested state record (a "world") with campaigns, books, chapters, scenes, actors, locations, inventory, and many smaller fields. On any turn, the user takes an action, the server resolves it, and the world changes — usually by mutating a small number of fields deep inside the tree.

The naive shape is for each handler to compute its own version of the new world (`{ ...world, campaigns: [...] }`) and persist that. The naive shape grows weeds quickly: every handler has to know the full nesting, the mutation logic spreads across the codebase, and a bug in any one handler produces a slightly-wrong world that flows downstream.

The pattern is a single discriminated-union type that names every kind of change the world can undergo, plus a single `apply()` function that uses an exhaustive switch:

```typescript
type WorldOp =
  | { type: 'spawnActor'; path: string; actor: ActorRecord }
  | { type: 'moveActor'; path: string; toLocationPath: string }
  | { type: 'addInventoryItem'; path: string; item: ItemRecord }
  | { type: 'recordEvent'; path: string; event: EventRecord }
  | { type: 'advanceTime'; minutes: number }
  | ...

export function apply(world: WorldRecord, op: WorldOp): WorldRecord {
  switch (op.type) {
    case 'spawnActor':       return applySpawnActor(world, op)
    case 'moveActor':        return applyMoveActor(world, op)
    case 'addInventoryItem': return applyAddInventoryItem(world, op)
    case 'recordEvent':      return applyRecordEvent(world, op)
    case 'advanceTime':      return applyAdvanceTime(world, op)
    default:
      const _exhaustive: never = op
      throw new Error(`Unknown WorldOp type: ${(op as WorldOp).type}`)
  }
}
```

Every handler that wants to change the world produces ops, not mutated worlds. The server applies the ops, persists the new world, and bumps an optimistic `sequenceId`. The client subscribes to ops and applies the same `apply()` function locally — both sides stay in sync without duplicating mutation logic. Adding a new op type makes the build fail until every consumer handles it.

The pattern earns its weight when your state record has more than a couple of nested levels, multiple handlers all need to mutate it, and you want client and server to stay in sync without writing two implementations. A single-level record (a flat row in a database) doesn't need it; a spread is fine.

---

## Path-string addressing for nested records

*Generalises: "one path string, not scattered ID parameters" — see `engineering/ENGINEERING_PRINCIPLES.md` → "Addressing".*

A nested record (the world above) needs every handler, route, job payload, and wire type to identify "where in the tree this operation applies." The naive shape carries six separate ID parameters per signature; the better shape carries one path string.

```
/tenant/t1/world/w1/campaign/c1/book/b1/chapter/ch1/scene/s1/actor/a1/location/l1
```

Any subset, any order. A single `StoryPath` utility parses the string at the top of the function:

```typescript
async function moveActor(path: string, toLocationPath: string): Promise<Result> {
  const { tenantId, worldId, actorId } = StoryPath.ids(path, 'tenant', 'world', 'actor')
  // ...
}
```

The `ids(path, ...kinds)` call is type-safe: if you ask for `'actor'` and the path doesn't have one, it throws. Adding a new addressable kind (say `faction`) means adding one line to the `StoryPathKind` union — no signature changes anywhere.

The pattern earns its weight when records nest at least three levels deep and multiple unrelated handlers need to address records at different levels of the tree. A flat schema or a single nesting level doesn't need it.

---

## AI does fuzzy logic, code does deterministic logic — the worked taxonomy

*Generalises: "AI Does Fuzzy Logic. Code Does Deterministic Logic." — see `engineering/ENGINEERING_PRINCIPLES.md`.*

Drawing the line between "this is a model call" and "this is a function call" is project-specific. For a turn-based game with deterministic mechanics (dice rolls, ability checks, combat resolution) and narrative output (DM voicing the scene, NPC dialogue, scene descriptions), the line falls in a specific place.

**Code does** (deterministic, never a model call):

- Dice rolls. `DiceRoller.roll('2d20kh1')` (advantage). Same input always produces same output, modulo intentional randomness.
- Ability and skill checks. `Check.resolve(actor, skill, dc) → { rolled, modifier, total, success }`. Pure math.
- Combat resolution. Attack rolls, damage rolls, status-effect application — all deterministic.
- World-state mutations. Every change goes through `WorldOps.apply()`.
- Permissions and authorization. Whether a user can perform an action is computed by code.
- Scene-graph navigation. Finding the parent campaign of a scene is a tree walk, not a model call.

**Models do** (fuzzy, never a deterministic function):

- Voicing the dungeon master ("the door creaks open, dust falls from the lintel..."). Style, tone, fit.
- Voicing NPCs in dialogue. Their personality is data; their words are generated.
- Classifying free-text player input ("attack the goblin" → combat-resolve; "ask the bartender about the rumor" → barter). Edge cases require interpretation.
- Generating actor backstories, location descriptions, item flavour text.
- Summarising what happened this scene for memory storage.
- Deciding what's narratively interesting *next* (story-direction signals to the DM).

When a feature genuinely needs both, the deterministic side runs first and the model is given the result as context. The model voices the outcome but never reverse-engineers it:

```
Player: "I attack the goblin."
   ↓
Mechanics agent (code): rolls attack, rolls damage, applies status
   → result: { hit: true, damage: 7, goblinHp: 3 }
   ↓
DM agent (model): given the result, voices the moment
   → "Your blade catches the goblin in the shoulder; it staggers, snarling,
      blood seeping through its leather wraps."
```

The model never gets to decide whether the attack hit. The function never gets to decide how it sounds. A model that's asked to do deterministic work will get it right most of the time and silently wrong some of the time; a function that's asked to do creative work will be flat and repetitive.

---

## AI agent fleet for a narrative pipeline

*Generalises: agent naming and pipeline-step shape — see `engineering/ENGINEERING_PRINCIPLES.md` → "Refactoring Heuristics".*

A turn-based game with AI narration has several role-typed agents that fire in a fixed order during a turn. Each agent has one job, takes a typed context, returns a typed result. The action loop is the orchestrator that wires them together.

The roles:

- **Mechanics agent.** Classifies the player's input as `narrative`, `check`, `combat`, `barter`, `spell`, `rest`, or another category. Returns a typed directive.
- **Director agent.** Picks the next story beat from a list of candidates. Returns a story-direction signal.
- **Story agent.** Analyses the just-generated scene for changes worth persisting to memory (a new NPC name, a plot beat, an actor's emotion shift). Returns a list of memory ops.
- **DM agent.** Voices the narration. Takes the directive, the story direction, and the scene context. Returns prose.
- **Transition agent.** When the scene is about to end, decides what comes next (a new location, a time skip, a new chapter).

The flow:

```
Player input
   ↓
Mechanics agent → directive
   ↓
   (if directive is deterministic: dice / combat / barter)
   resolve via code → result
   ↓
Director agent → story direction (which beat to use)
   ↓
DM agent → narration prose
   ↓
   (after the DM responds)
Story agent → memory ops
Transition agent → transition op
   ↓
Apply ops to world; persist; return to player
```

Each agent is one class. Each has one public method (`act(context)`). Each takes a `Clients` container with role-typed model clients (`StoryClient`, `UtilityClient`, `EmbeddingClient`, `MediaClient`) and a scope-bound `MemoryService`. The orchestrator reads like a table of contents; you can understand the turn shape in 30 seconds.

A simple chatbot with one model call per user message doesn't need any of this — one agent, one method, one model call. The pattern earns its weight when more than one cognitive task (classification, generation, summarisation, decision-making) has to happen per user interaction and you want each task to be testable and replaceable.

---

## Memory strategy for long-running AI sessions

*Generalises: "deterministic over LLM/memory when the data exists" — see `engineering/ENGINEERING_PRINCIPLES.md` → "Refactoring Heuristics" rule 6.*

A long-running AI session (a campaign that spans days of play) accumulates more state than fits in a single model context. You need to remember what happened in scenes the model wasn't part of.

The pattern: keep deterministic state on the canonical record (the world). Use a memory store only for things that genuinely need semantic recall.

On the world record (deterministic): who the actors are, where they are, what they're wearing. What's happened in each scene structurally (which actors moved, which items changed hands). The chapter / book / campaign hierarchy. Time of day, time elapsed, weather.

In the memory store (semantic): plot beats that don't have a structural anchor (a character revealed they were lying; a faction is plotting against the player; a recurring NPC had a name change). "Used hooks" — story openings that have already been deployed in this campaign so the next scene doesn't reuse them. Player preferences gleaned from prior sessions ("the player gravitates toward stealth").

A grep before a vector search. Most of what looks like "this needs memory" turns out to be projectable from the world record. The DM agent gets a structural projection of recent state (everything that happened in the parent chain) plus a small set of semantically-relevant memory records — not "the last 1000 turns." Memory writes happen at boundaries you can name (after the story agent runs), not after every prompt.

If your session fits in one context window, you don't need this. Just pass the relevant state.

---

## Story-pipeline structure: scenes, chapters, books, campaigns

A narrative project benefits from a fixed hierarchy that the user, the AI agents, and the persistence layer all agree on. From smallest to largest:

- **Turn.** One player input plus one DM response. Not a unit of persistence on its own; rolled up into a scene.
- **Scene.** Roughly 5-30 turns. One coherent moment of action (a fight, a conversation, a journey). Has a start, an end, and a list of actors present.
- **Chapter.** Roughly 3-7 scenes. One thread of the story. Has a goal at the start, a resolution at the end. Ends when the goal is reached, frustrated, or abandoned.
- **Book.** Roughly 3-7 chapters. One arc of the campaign. Has a thematic concern (a faction, a question, a relationship). Ends when the arc resolves.
- **Campaign.** The whole story. One world, one party, one continuing journey. Open-ended; ends when the player retires the campaign.

Each level has its own close-handler — a background job that runs when the level ends. Scene-close summarises; chapter-close generates the next chapter's setup; book-close generates the next book's arc-question.

The hierarchy maps directly onto the path-string addressing pattern above:

```
/world/<worldId>/campaign/<campaignId>/book/<bookId>/chapter/<chapterId>/scene/<sceneId>/
```

---

## Prompt-rule specifics for narrative-output models

*Generalises: the `ships-llm-prompts` architecture tag throughout the kit. See the `prompt_audit` agent for the auditing mechanics.*

When the model's output is free prose (a DM scene description, an NPC's line of dialogue, a generated backstory), the rules that improve quality are different from the rules for JSON-output prompts.

- **Positive-form instructions only.** A model told "don't make NPCs reveal hidden information" is more likely to mention hidden information than one told "have NPCs hint at hidden information only when the character chooses to reveal it." Negative forms paradoxically prime the very behaviour they prohibit.
- **Section labels matter.** `=== SCENE STATE ===` works; `=== PAYLOAD ===` doesn't. The model reads the label and primes its expectations accordingly.
- **Wrong / Right anchors only when the rule is abstract.** If you can state the rule concretely, skip the examples. If you can't, examples earn their tokens.
- **No developer jargon in prompt text.** No class names, no type names, no field paths. The model has none of that context.
- **TASK goes at the end.** Context first, instruction last. Models attend more to the end of the user message.

These rules are part of why projects that ship LLM prompts benefit from running a `prompt_audit` agent.

---

## Rules-system compliance (D&D 5e SRD as the example)

*Generalises: "rules-as-data, not scattered through logic" — see `engineering/ENGINEERING_PRINCIPLES.md` → SOLID → Open/Closed.*

When your project applies an existing rules system (a board game, a tabletop RPG, an established framework), the implementation needs a reviewer agent that knows the rules. The pattern in the original project: a "Wallace" reviewer that reads the system reference document on every review, verifies new mechanical rules match it, allows house rules and homebrew only when they carry a `// House rule:` or `// Homebrew:` comment with rationale, and reviews tests for the rules — if a class implements a rule, there's a test asserting the rule.

If your project applies an established rules system, lift Wallace's shape into your own reviewer agent and point it at your reference document.
