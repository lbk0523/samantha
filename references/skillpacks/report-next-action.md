# Skillpack: Report And Next Action

Status: seed advisory skillpack

## Purpose

Reduce Samantha's closeout bottleneck: reporting evidence clearly and choosing
the right next-action level without collapsing every result into another
worker-sized task.

## Trigger Signals

Use this pack when:

- Samantha is closing a plan, review, recovery, implementation, or inspection;
- the next action could be CEO-level, plan-level, task-spec-level, recovery, or
  no action;
- BK needs the result, evidence, and remaining boundary without reading raw
  logs or long worker prose;
- a recommended next prompt should be copy-paste-ready.

## Read-First Artifacts

- `WORK-RULES.md` next-action level gate and final response checklist.
- `OPERATING_GUIDE_KR.md` for BK-facing language and prompt shape.
- Current task spec, run log, review report, or plan artifact being closed.
- Relevant initiative brief when the work belongs to a multi-slice initiative.

## Required Inputs

- What changed, or what was reviewed.
- Verification or the reason verification is unavailable.
- Changed-file scope when files changed.
- Open decisions, blockers, or residual risks.
- Current initiative or route state, if any.

## Procedure

1. Lead with the outcome and evidence that matters most.
2. Separate verified completion, advice-only findings, open decisions, and
   untrusted worker claims.
3. Choose the next-action level:
   `CEO capability`, `plan`, `task spec`, `command`, `review`, `recovery`,
   `adjacent initiative`, or `no next action`.
4. Recommend a worker-sized task only when the higher-level boundary is already
   accepted and safe.
5. If no meaningful cohesive slice remains, say `No next action recommended`
   and why.
6. When a Samantha-authored handoff prompt is useful, provide one fenced text
   block with stable slots and Korean-facing output requirements.

## Output Contract

```text
Outcome:
Evidence checked:
Remaining risk or decision:
Next action level:
Recommended next action:
```

For implementation closeout, include verification commands or state that they
could not be run. For report-only work, say explicitly that no trusted state was
changed.

## Evaluation Checks

- The report does not claim completion without deterministic evidence.
- The next action is at the highest useful abstraction level.
- The report does not leave BK with a manual push, cleanup, or verification step
  when Samantha can already do it under the current authority.
- Report-only findings remain advice-only.
- Handoff prompts preserve the canonical `Context`, `Ask`, `Scope`, `Output`,
  and `Stop` slots when slots are used.

## Authority Limits

This pack can summarize and recommend. It cannot create commits, push, clean
up, mutate lifecycle records, accept runs, dispatch workers, promote lessons,
or mark an initiative complete without the required evidence.

## Stop Conditions

Stop or report blocked when:

- completion evidence is missing or contradictory;
- the next action would require authority not granted in the current route;
- a recommended prompt would smuggle in implementation, policy, lifecycle, or
  platform work that was not accepted;
- the result belongs in an initiative update that has no accepted artifact
  target.
