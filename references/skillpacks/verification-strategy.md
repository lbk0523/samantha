# Skillpack: Verification Strategy

Status: seed advisory skillpack

## Purpose

Reduce Samantha's verification bottleneck: choosing checks that are strong
enough to prove the changed surface without adding broad, duplicated, or weak
verification noise.

## Trigger Signals

Use this pack when:

- a task spec needs verify commands;
- a worker run failed because verification was missing, unrelated, too broad, or
  permanently impossible;
- a docs-only, policy, or shared-code task needs the right check level;
- repeated verification duplication is causing low-signal worker or harness
  effort.

## Read-First Artifacts

- `references/playbooks/verification-duplication.md` for verification
  vocabulary and authority boundaries.
- The nearest task template under `references/task-templates/**`.
- Existing tests for the changed surface.
- `WORK-RULES.md` implementation and verification rules.
- Source files or docs that the proposed task will touch.

## Required Inputs

- Target files and expected change type.
- Risk class: docs-only, routine implementation, shared behavior, policy, or
  authority-sensitive work.
- Existing tests, scripts, or markdown-surface checks.
- Known environment limitations if a command cannot run.

## Procedure

1. Start with the most focused deterministic check tied to the target files.
2. Add broader sanity checks only when the changed surface can affect shared
   behavior, contracts, or package-level correctness.
3. For docs-only work, prefer markdown-surface checks such as required text,
   forbidden text, added-line checks, and `git diff --check`.
4. For policy or authority changes, require accept and reject tests for the
   intended boundary.
5. Keep worker-side checks advisory. Harness `verifyCommands` remain the
   trusted acceptance surface.
6. If a command is useful but currently unavailable, record the reason and avoid
   claiming verification passed.

## Output Contract

```text
Verification class: focused | broad | docs-surface | policy-gate
Primary command:
Additional commands:
Changed surface covered:
Why this is enough:
What is intentionally not checked:
Unavailable checks:
```

These labels are planning vocabulary. The actual TaskSpec still stores
`verifyCommands` as the repository's current command strings.

## Evaluation Checks

- Each command maps to a target file, caller, template, or authority boundary.
- Docs-only commands do not run unrelated source test suites by default.
- Policy changes include both allowed and forbidden examples.
- No worker report, `WORKER_VERIFY_EVIDENCE`, or skipped-check disclosure is
  treated as harness acceptance evidence.
- The strategy explains omitted broad checks when they would otherwise be
  expected.

## Authority Limits

This pack can recommend verification. It cannot waive declared verify commands,
change the TaskSpec contract, accept worker output, downgrade policy gates,
mutate lifecycle state, or replace Samantha-owned verification.

## Stop Conditions

Stop when:

- no deterministic check can be tied to the changed surface;
- the only proposed check is worker judgment or prose;
- passing would require changing the task contract rather than the target
  artifact;
- a structured verification metadata change is being proposed without repeated
  evidence and focused tests.
