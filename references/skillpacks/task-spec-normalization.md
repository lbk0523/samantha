# Skillpack: Task Spec Normalization

Status: seed advisory skillpack

## Purpose

Reduce Samantha's dispatch bottleneck: turning an accepted natural-language goal
into a bounded, dispatch-safe work unit without losing target scope,
verification intent, stop conditions, or authority boundaries.

## Trigger Signals

Use this pack when:

- BK accepts a plan and wants execution normalized;
- a `command`-style request is decision-complete but not yet a safe task spec;
- a proposed worker task lacks target files, forbidden changes, verify commands,
  or stop conditions;
- a follow-up from recovery needs to preserve the original failure evidence and
  repair boundary;
- Samantha self-build work needs persistent or ephemeral task spec lifecycle
  handling.

## Read-First Artifacts

- `references/task-templates/*.json` for the nearest existing task shape.
- `references/playbooks/self-build-task-spec-lifecycle.md` when the task spec
  should live in or outside `references/tasks/**`.
- `WORK-RULES.md` for implementation, self-build, and completion gates.
- Existing target files and immediate callers before any proposed writer work.
- `references/playbooks/context-resolver-evidence-activation.md` when the task
  follows from a route-specific evidence pack.

## Required Inputs

- Accepted goal or exact user request.
- Target repository and current work level.
- Candidate target files or the smallest safe discovery step to identify them.
- Forbidden changes and non-goals.
- Verification strategy or the reason it is not yet known.
- Worker profile and result mode: writer, reviewer, or report-only.

## Procedure

1. Confirm the work is actually executable. If product direction, authority, or
   target scope is still undecided, return `needs_plan`.
2. Choose the closest existing task template. Do not invent a new task class
   when a current template fits.
3. Declare target files narrowly and forbidden changes broadly enough to protect
   adjacent authority surfaces.
4. Attach verify commands that match the changed surface. Use
   `verification-strategy.md` when the right command is unclear.
5. Add worker instructions that include read-before-write context, stop
   conditions, and one `HARNESS_RESULT` expectation when a harness worker will
   run.
6. Choose persistent vs ephemeral task spec lifecycle before dispatch. Do not
   backfill temporary specs into `references/tasks/**` after a run.
7. Return a readiness report if any required field is missing.

## Output Contract

```text
Verdict: ready | needs_plan | blocked
Task family:
Result mode:
Target files:
Forbidden changes:
Setup commands:
Verify commands:
Spec lifecycle: persistent | ephemeral | not_applicable
Stop conditions:
Read-before-write context:
Open decisions:
```

When writing an actual TaskSpec is authorized, the JSON must preserve the same
fields in the repository's existing schema and template style.

## Evaluation Checks

- No unresolved placeholder is hidden inside a dispatch-ready task.
- Every writer task has target files, forbidden changes, and verify commands.
- Report-only tasks have empty target files and forbid all writes.
- Verify commands are connected to target files or declared risk.
- Self-build task specs follow the persistent or ephemeral lifecycle rule before
  dispatch.

## Authority Limits

This pack can draft or review a task spec boundary. It cannot dispatch a worker,
create a worktree, accept a run, commit, push, clean up, mutate lifecycle state,
rewrite policy, or promote lessons.

## Stop Conditions

Stop when:

- target files are unknown and cannot be identified with bounded discovery;
- verify commands would be unrelated, permanently failing, or purely cosmetic;
- the requested task would require worker-owned orchestration, connector access,
  secrets, background operation, or policy/doctrine mutation;
- a self-build implementation request must go through the SDK-backed Samantha
  worker gate before trusted completion can be claimed.
