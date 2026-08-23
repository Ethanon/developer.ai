# Examples

**Start with [`reviews/findings-gallery.md`](reviews/findings-gallery.md)** if you are evaluating the kit. It shows what each reviewer catches, in short concrete entries you can skim by agent, plus the silences that keep the real findings readable. The decision docs below are for when you are writing your own.
: worked decision docs

This folder holds four decision docs (architectural decision records, sometimes called ADRs) as worked examples. They are referenced by `engineering/ENGINEERING_PRINCIPLES.md`, the kit's review agents (Alice, Bob), and the templates, so any rule or template that points at one is pointing here.

The four were chosen to teach four different shapes of decision:

| File | Shape it teaches |
|---|---|
| `decisions/004-auth-gateway.md` | A security / vendor decision with explicit "what we considered and rejected." |
| `decisions/028-client-layer.md` | An architectural layering decision. |
| `decisions/037-fail-loud.md` | An engineering-philosophy decision. |
| `decisions/071-scheduled-bots-on-github-actions.md` | An ops / automation decision (relevant to anyone adopting this kit). |

You don't have to write decision docs today. But when you do (and you should) copy `templates/decisions/DECISION_TEMPLATE.md` and look at whichever of these is closest in shape to what you're writing.

## Where the filled-in examples are

There are no worked `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, or `SECURITY.md` examples here. The templates under `templates/` ship with opinionated defaults already in place, so the template itself is the worked example. Read it directly.
