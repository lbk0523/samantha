# Samantha Skillpacks

Status: seed advisory capability layer

## Purpose

Samantha skillpacks group repeated Samantha judgment work into reviewable
capability units. They make recurring work faster by preserving the trigger,
procedure, output contract, evaluation surface, and authority boundary for a
specific Samantha bottleneck.

A Samantha skillpack is not a global Codex skill, runtime resolver,
dispatch hook, policy gate, hidden memory, or automatic promotion mechanism.
It is a repository artifact that Samantha or Codex can read when the matching
manual route applies.

## Anatomy

Each skillpack should define:

- `Purpose`: the Samantha bottleneck the pack reduces.
- `Trigger signals`: when to load the pack.
- `Read-first artifacts`: the smallest existing docs, playbooks, templates, or
  evidence files needed before applying it.
- `Required inputs`: evidence or decisions that must be present.
- `Procedure`: the judgment steps the agent should follow.
- `Output contract`: the shape of the report, task spec candidate, or decision.
- `Evaluation checks`: fixture, grep, diff, or run-evidence checks that prove the
  pack was applied correctly.
- `Authority limits`: transitions the pack may advise on but never own.
- `Stop conditions`: when to report blocked instead of broadening scope.

## First Priority Packs

These are ordered by Samantha-side bottleneck, not BK-side inconvenience.

| Order | Skillpack | Bottleneck | Output |
| --- | --- | --- | --- |
| 1 | `context-route-selection.md` | Samantha reads too broadly, chooses the wrong work level, or drops into execution too early. | Smallest route, evidence pack, stop condition, and next-action level. |
| 2 | `task-spec-normalization.md` | Natural-language work becomes under-scoped, over-scoped, or dispatch-unsafe. | TaskSpec readiness report or bounded task spec candidate. |
| 3 | `verification-strategy.md` | Verification is too broad, duplicated, weak, or disconnected from the changed surface. | Focused verify plan with any justified broader checks. |
| 4 | `run-evidence-diagnosis.md` | Worker prose, `HARNESS_RESULT`, verification, scope, and lifecycle evidence get blended. | Trusted/untrusted evidence classification and bounded recovery or accept recommendation. |
| 5 | `report-next-action.md` | Samantha final reports recommend the wrong abstraction level or leave BK with low-value follow-up work. | Evidence-grounded summary and exactly the right next-action level. |

## Shared Invariants

- Skillpacks may guide judgment, synthesis, decomposition, review, and
  next-action recommendation.
- Skillpacks must not make worker output trusted.
- Skillpacks must not accept runs, merge, clean up, push, mutate lifecycle
  state, rewrite policy, dispatch workers, or promote lessons automatically.
- Trusted state still comes from deterministic scope checks, verification
  commands, run evidence, lifecycle records, and Samantha-owned gates.
- If repeated evidence shows a skillpack should become policy, template,
  resolver code, hook behavior, or a global Codex skill, that promotion requires
  a separate reviewed task with focused tests.

## Manual Use

Use the smallest matching skillpack only after choosing the relevant Samantha
route. If a task needs more than one pack, apply them in pipeline order:

```text
context route
-> task spec normalization
-> verification strategy
-> run evidence diagnosis
-> report and next action
```

Do not preload all packs for ordinary tasks. The value of this layer is reducing
context and decision churn, not creating another always-on doctrine surface.
