# Skillpack: Run Evidence Diagnosis

Status: seed advisory skillpack

## Purpose

Reduce Samantha's post-run bottleneck: separating trusted evidence from worker
prose and deciding whether the next action is accept, rework, recovery, rerun,
or stop.

## Trigger Signals

Use this pack when:

- a run is failed, blocked, stale, incomplete, malformed, or suspiciously
  successful;
- `HARNESS_RESULT`, worker prose, changed-file scope, verification output, and
  lifecycle records appear to disagree;
- BK asks whether a run is safe to accept or what recovery should happen next;
- a follow-up task must cite failure evidence without trusting failed output.

## Read-First Artifacts

- Source run log under `runs/**`.
- Original task spec when available.
- `runs/index.jsonl` or lifecycle records when acceptance or cleanup state
  matters.
- `references/playbooks/context-resolver-evidence-activation.md` failed-run
  recovery row.
- `WORK-RULES.md` trust gate and completion rules.

## Required Inputs

- Run id or path.
- Original task id or task spec path when available.
- `HARNESS_RESULT` line if present.
- Top-level evaluation state, changed-file scope, verify output, candidate
  commit, base/stale state, and lifecycle status.

## Procedure

1. Treat worker prose and `HARNESS_RESULT` as evidence, not trusted completion.
2. Check top-level evaluation state and changed-file scope outside the worker's
   judgment.
3. Check deterministic verification output and whether it corresponds to the
   task's declared commands.
4. Check candidate commit, base freshness, mergeability, cleanup, and lifecycle
   records only when relevant to the decision.
5. Classify the run:
   `accepted_candidate`, `verify_failed`, `scope_failed`, `blocked`,
   `stale_base`, `malformed`, `superseded`, `report_only`, or `unknown`.
6. Recommend exactly one bounded next action: accept, rerun from current base,
   create recovery task, ask BK, run report-only review, or stop.

## Output Contract

```text
Outcome:
Trusted evidence:
- <source>: <what it proves>
Untrusted or advisory evidence:
- <source>: <why it is not enough>
Failure class:
Next bounded action:
Stop reason:
```

Use `Stop reason` when no trustworthy next action can be recommended.

## Evaluation Checks

- A passing `HARNESS_RESULT` without matching top-level verification is not
  reported as accepted.
- A stale-base run recommends rerun against current base instead of force accept.
- Failed worker edits are not trusted as completed work.
- Report-only output is not treated as mergeable writer output.
- Recovery tasks preserve the failed command or scope evidence that made the
  source run untrusted.

## Authority Limits

This pack can diagnose and recommend. It cannot accept runs, reject runs,
mutate lifecycle state, clean up worktrees, merge, commit, push, dispatch
workers, or create task specs without a separate authorized task.

## Stop Conditions

Stop when:

- the run log or task spec needed for classification is missing;
- lifecycle state cannot be reconstructed from trusted evidence;
- the requested next action would accept unverified changes;
- diagnosis would require policy changes, hidden retry behavior, or worker-owned
  lifecycle authority.
