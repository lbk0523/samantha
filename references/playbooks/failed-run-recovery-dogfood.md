# Playbook: Failed-Run Recovery Dogfood

## When To Use

Use this playbook when designing a Samantha dogfood run whose purpose is to
exercise failed-run diagnosis and follow-up generation.

The core invariant is: Design failed-run recovery dogfood with fixable failures.
The source run should fail because an artifact is incomplete, not because the
verification command is permanently impossible.

## Required Inputs

- A source task that has explicit target files, forbidden changes, and focused
  verify commands.
- A failure condition that a bounded follow-up can repair by editing the
  declared target artifact.
- A verify command that should pass after the missing or incomplete artifact
  content is corrected.
- Run evidence that records the failed verify command, changed-file scope, and
  `HARNESS_RESULT`.

## Procedure

1. Choose a narrow artifact-level failure, such as a missing marker line,
   missing section, or incomplete documented claim.
2. Make the source run fail on a deterministic verify command that points at
   that incomplete artifact.
3. Avoid commands whose failure is permanent, environmental, or unrelated to
   the declared target files.
4. Generate the recovery follow-up from the failed run evidence.
5. Keep the follow-up bounded to the same repairable artifact problem unless
   the run evidence shows the original task contract was wrong.
6. Accept the dogfood only when the follow-up can satisfy the original
   verification intent without changing the recovery contract.

## Verification Expectations

Verification should show:

- the source run failed for the intended incomplete-artifact reason;
- the failed verify command is deterministic and repairable;
- the follow-up task can make the command pass by completing the artifact;
- changed-file scope stayed within the declared target files;
- run evidence preserved `HARNESS_RESULT` and verification output.

## Authority Limits

This playbook does not authorize workers to change task contracts, verification
policy, lifecycle state, commits, pushes, hidden memory, automatic promotion, or
orchestration behavior. If the only way to pass is to change the verify command,
the dogfood design is wrong and should be reported for rework.

## Source Evidence

- Lesson candidate:
  `references/lessons/inbox/2026-05-16T05-15-18-040Z-sdk-failed-recovery-dogfood.md`
- Source failed run:
  `runs/2026-05-16T05-15-18-040Z-sdk-failed-recovery-dogfood.json`
- Generated follow-up:
  `references/tasks/sdk-failed-recovery-follow-up.json`
- Passing follow-up run:
  `runs/2026-05-16T05-16-42-812Z-sdk-failed-recovery-follow-up.json`

