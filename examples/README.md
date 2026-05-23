# Examples: one cohesive reference project

The files in this folder show what the `templates/` slots look like when they're filled in. They aren't meant to be copied verbatim — they're meant to be read end-to-end as one consistent picture, so you can see how the pieces hang together before you fill in your own.

The example project is deliberately generic. There is no product name, no company name, and no domain-specific quirks. The shape is "a project with a frontend, a backend, an auth service, a database, and a couple of helper containers" — the same shape most teams adopting this kit will have. As you read, mentally substitute your own service names; the patterns transfer.

## What's in here

| File | Mirrors |
|---|---|
| `PROJECT_CONTEXT.md` | `templates/PROJECT_CONTEXT.md` filled in |
| `ARCHITECTURE.md` | `templates/ARCHITECTURE.md` filled in |
| `SECURITY.md` | `templates/SECURITY.md` filled in |
| `decisions/004-auth-gateway.md` | A real-shaped decision about the sign-in flow |
| `decisions/028-client-layer.md` | A real-shaped decision about how the backend talks to outside services |
| `decisions/037-fail-loud.md` | A real-shaped decision about error handling |
| `decisions/071-scheduled-bots-on-github-actions.md` | A real-shaped decision about how the maintenance bots run |

## How to use this folder

Pick one of two approaches:

1. **Read first, then fill.** Read every file in this folder end-to-end. You'll absorb the voice, the level of detail, and the shape of a good fill. Then go to `templates/` and write your own.
2. **Fill first, then check.** Open `templates/PROJECT_CONTEXT.md` and start filling. When you get stuck on a slot, jump to the matching slot in this folder for a worked example.

Both work. Most adopters do a hybrid — skim this folder once, then fill while keeping it open in a second tab.

## Reading order

If you read this folder front to back, this order tells the most coherent story:

1. `PROJECT_CONTEXT.md` — what this project is.
2. `ARCHITECTURE.md` — how the pieces fit together.
3. `SECURITY.md` — how user identity and trust work.
4. `decisions/004-auth-gateway.md` — a decision the security model rests on.
5. `decisions/028-client-layer.md` — how the backend stays portable across vendors.
6. `decisions/037-fail-loud.md` — how the system handles failure.
7. `decisions/071-scheduled-bots-on-github-actions.md` — how the maintenance bots run.

The four decision docs are not exhaustive. They are picked to teach four different shapes of decision (security/vendor, layering, philosophy, ops). When you write your own, look at the one closest in shape to yours and copy the rhythm.
