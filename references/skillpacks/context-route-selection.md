# Skillpack: Context Route Selection

Status: seed advisory skillpack

## Purpose

Reduce Samantha's first-step bottleneck: choosing the wrong work level, loading
too much context, or dropping into implementation before the route and evidence
pack are clear.

## Trigger Signals

Use this pack when:

- a new BK request could be doctrine, planning, implementation, review,
  recovery, learning, or lifecycle work;
- a prefix-free follow-up might change intent or work level;
- an external AI-collaboration idea is being absorbed into Samantha;
- the next action could be either CEO-level direction or worker-sized execution;
- a task looks simple but may touch authority, policy, lifecycle, or product
  boundaries.

## Read-First Artifacts

- `AGENTS.md` for hard product and authority gates.
- `WORK-RULES.md` for next-action level and completion discipline.
- `references/context-resolver-index.md` for the smallest matching manual route.
- `references/playbooks/context-resolver-evidence-activation.md` for the route's
  evidence pack, applicability gate, stop condition, and feedback target.
- `NORTH_STAR.md` or `ARCHITECTURE.md` only when product identity, authority, or
  trust boundaries are actually in scope.

## Required Inputs

- Current user request and any active intent signal.
- Current repository or target workspace.
- The smallest plausible route and why broader routes are unnecessary.
- Any explicit source evidence supplied by BK, such as a link, run id, task
  spec, review comment, or accepted decision.

## Procedure

1. Classify the request stage before choosing tools:
   `doctrine_or_architecture`, `decision_complete_implementation`,
   `report_only_review`, `recovery_or_lifecycle`, or `open_discussion`.
2. Choose the smallest route from `references/context-resolver-index.md`.
3. Read the route's `When not to read them` and `Authority limits` columns before
   opening additional artifacts.
4. Activate only the evidence categories named by the evidence activation
   playbook.
5. Decide the next-action level before recommending execution:
   CEO capability, plan artifact, task spec normalization, report-only review,
   recovery action, or no action.
6. If the route is ambiguous and the difference changes authority or target
   files, ask BK instead of blending routes.

## Output Contract

Return a compact routing note when the route matters:

```text
Route:
Task stage:
Read first:
Evidence pack:
Authority limits:
Stop condition:
Next action level:
```

For small tasks, the same fields may be summarized in prose instead of a table.

## Evaluation Checks

A correct route selection should be able to pass these manual fixture checks:

- A doctrine or architecture question does not become a task spec or code edit.
- A report-only review does not authorize writes, lifecycle mutation, or commit.
- A failed-run recovery cites source run evidence before proposing follow-up.
- A docs-only task does not read broad policy or source files unless the doc
  moves authority.
- A decision-complete implementation task reaches task-spec normalization
  instead of staying in open-ended brainstorming.

## Authority Limits

This pack can recommend a route and evidence pack. It cannot dispatch workers,
create task specs, accept runs, mutate lifecycle records, change policy, promote
lessons, create hidden memory, or implement resolver code.

## Stop Conditions

Stop and report blocked or ask BK when:

- the route would materially change authority, target files, or lifecycle state;
- the request depends on a missing source artifact that cannot be inferred;
- route choice would require automatic context loading, hidden memory, runtime
  resolver behavior, or policy changes;
- the evidence activation playbook says the current route must stop.
