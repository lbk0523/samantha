# Lesson Candidate: 2026-05-21T06-59-35 Sequential CEO Autopilot Session

## Source

- Source type: curated operator synthesis from the Sequential CEO Autopilot
  S9.1-S24 lifecycle.
- Review note: This is raw learning data plus explicit promotion candidates.
  It does not by itself change policy, code, tests, task templates, agent
  profiles, or authority boundaries.
- Promotion state: high-priority lessons were selected for narrow playbook
  updates in the same session. Medium and low-priority lessons remain review
  candidates unless a promoted artifact separately adopts them.

## Source Artifacts

- Initiative record:
  `references/initiatives/sequential-ceo-autopilot.md`
- Boundary and decision artifacts:
  `references/initiatives/sequential-ceo-autopilot-s11-run-task-preflight-boundary.md`,
  `references/initiatives/sequential-ceo-autopilot-s14-single-run-task-decision.md`,
  `references/initiatives/sequential-ceo-autopilot-s17-post-run-lifecycle-boundary.md`
- Dogfood reports:
  `references/operations/sequential-ceo-autopilot-s19-run-accept-preflight-report.md`,
  `references/operations/sequential-ceo-autopilot-s21-accept-run-once-report.md`,
  `references/operations/sequential-ceo-autopilot-s23-dogfood-report.md`
- S23 operation evidence:
  `references/operations/sequential-ceo-autopilot-s23-run-task-report.json`,
  `references/operations/sequential-ceo-autopilot-s23-accept-report.json`,
  `references/operations/sequential-ceo-autopilot-s23-post-accept-status-report.json`
- Correction evidence:
  `references/tasks/sequential-ceo-autopilot-s9-1-linkage-validation-order.json`,
  `references/tasks/sequential-ceo-autopilot-s22-post-accept-status-rework.json`
- Weak auto-generated lesson candidates used only as bad-shape examples:
  `references/lessons/inbox/2026-05-20T00-37-17-545Z-sequential-ceo-autopilot-s8-schema-example-correction.md`,
  `references/lessons/inbox/2026-05-20T04-31-56-096Z-sequential-ceo-autopilot-s11-contract-field-correction.md`

## High Priority Lessons

### H1 Fixed Remaining Roadmap

- Invariant: when slices keep expanding, lock the remaining roadmap to a
  bounded range such as S15-S24 and move new authority into a separate
  initiative instead of adding S25+ by drift.
- Evidence: `references/initiatives/sequential-ceo-autopilot.md` records the
  fixed S15-S24 roadmap and S24 closure.
- Target artifact: `references/playbooks/initiative-continuity-brief.md`.

### H2 Completion Candidate And Closure Decision Are Different

- Invariant: the slice that proves the MVP path should not also be the slice
  that closes the initiative. S23 proved the end-to-end writer continuation
  candidate; S24 made the explicit closure decision.
- Evidence: `references/operations/sequential-ceo-autopilot-s23-dogfood-report.md`
  and `references/initiatives/sequential-ceo-autopilot.md`.
- Target artifact: `references/playbooks/initiative-continuity-brief.md`.

### H3 Authority Expansion Order

- Invariant: expand authority in this order: design-only, report-only
  preflight, guarded single execution, dogfood, closure. Do not skip from
  design directly to routine execution.
- Evidence:
  `references/initiatives/sequential-ceo-autopilot-s11-run-task-preflight-boundary.md`,
  `references/initiatives/sequential-ceo-autopilot-s14-single-run-task-decision.md`,
  `references/initiatives/sequential-ceo-autopilot-s17-post-run-lifecycle-boundary.md`,
  `references/operations/sequential-ceo-autopilot-s19-run-accept-preflight-report.md`,
  `references/operations/sequential-ceo-autopilot-s21-accept-run-once-report.md`,
  and `references/operations/sequential-ceo-autopilot-s23-dogfood-report.md`.
- Target artifact: `references/playbooks/sequential-ceo-autopilot.md`.

### H4 Preflight Only Is Never An Execution Trigger

- Invariant: `preflight_only` or `accept_preflight_only` is report evidence
  only. Execution requires a separate closed execution object such as
  `runTaskExecution` or `runAcceptExecution`.
- Evidence:
  `references/initiatives/sequential-ceo-autopilot-s14-single-run-task-decision.md`
  and `references/initiatives/sequential-ceo-autopilot.md`.
- Target artifact: `references/playbooks/sequential-ceo-autopilot.md`.

### H5 Validate Predecessor Before Optional Fields

- Invariant: optional successor or candidate fields are inspected only after
  the current predecessor artifact is validated. Invalid predecessors must
  produce blocked evidence, not absent candidate reports.
- Evidence:
  `references/tasks/sequential-ceo-autopilot-s9-1-linkage-validation-order.json`,
  `references/initiatives/sequential-ceo-autopilot.md`, and
  `references/initiatives/sequential-ceo-autopilot-s11-run-task-preflight-boundary.md`.
- Target artifact: `references/playbooks/sequential-ceo-autopilot.md`.

### H6 Worker Output Text Is Not Trusted State

- Invariant: worker output prose is not trusted state. Trusted state comes
  from run logs, accept reports, lifecycle trajectory, deterministic status
  updates, scope checks, and verification output.
- Evidence:
  `references/initiatives/sequential-ceo-autopilot.md`,
  `references/operations/sequential-ceo-autopilot-s23-run-task-report.json`,
  `references/operations/sequential-ceo-autopilot-s23-accept-report.json`, and
  `references/operations/sequential-ceo-autopilot-s23-post-accept-status-report.json`.
- Target artifact: `references/playbooks/sequential-ceo-autopilot.md`.

### H7 Bind Accept Reports To The Updated Artifact

- Invariant: `acceptReport.artifactPath` must normalize to the exact
  continuation artifact being updated. Mismatched accept reports must reject
  before mutation.
- Evidence:
  `references/tasks/sequential-ceo-autopilot-s22-post-accept-status-rework.json`
  and `references/initiatives/sequential-ceo-autopilot.md`.
- Target artifact: `references/playbooks/sequential-ceo-autopilot.md`.

### H8 Runs Accept Is Compound Authority

- Invariant: `runs:accept` includes merge-gate recording, merge, lifecycle
  mutation, cleanup, and lesson evidence. It must go through report-only
  preflight before guarded routine execution.
- Evidence:
  `references/initiatives/sequential-ceo-autopilot-s17-post-run-lifecycle-boundary.md`,
  `references/operations/sequential-ceo-autopilot-s19-run-accept-preflight-report.md`,
  and `references/operations/sequential-ceo-autopilot-s21-accept-run-once-report.md`.
- Target artifact: `references/playbooks/sequential-ceo-autopilot.md`.

### H9 TaskSpec And Continuation Artifact Lifecycle

- Invariant: persistent TaskSpecs under `references/tasks/**` are planning
  artifacts and must be committed before dispatch. Execution-only continuation
  artifacts should live under `/tmp`, and durable results should be snapshotted
  as operation artifacts.
- Evidence:
  `references/playbooks/self-build-task-spec-lifecycle.md`,
  `references/operations/sequential-ceo-autopilot-s23-run-task-report.json`,
  `references/operations/sequential-ceo-autopilot-s23-accept-report.json`, and
  `references/operations/sequential-ceo-autopilot-s23-post-accept-status-report.json`.
- Target artifact: `references/playbooks/self-build-task-spec-lifecycle.md`.

### H10 Vague Lesson Candidates Are Low-Value

- Invariant: a promoted lesson must name a concrete invariant, evidence, and
  target artifact. Generic text such as "Preserve this task shape..." is useful
  only as raw evidence, not as promoted learning.
- Evidence:
  `references/lessons/inbox/2026-05-20T00-37-17-545Z-sequential-ceo-autopilot-s8-schema-example-correction.md`
  and
  `references/lessons/inbox/2026-05-20T04-31-56-096Z-sequential-ceo-autopilot-s11-contract-field-correction.md`.
- Target artifact: `WORK-RULES.md`.

## Medium Priority Lessons

### M1 Side-Effect Map Is An Authority Contract

- Lesson: side-effect maps are not descriptive metadata. They are the
  authority contract that says which state changes are permitted.
- Evidence: S15/S20/S23 evidence in
  `references/initiatives/sequential-ceo-autopilot.md` and
  `references/operations/sequential-ceo-autopilot-s23-dogfood-report.md`.

### M2 Push False Must Be Rechecked Every Slice

- Lesson: `pushPerformed: false` is not a one-time global assumption. Every
  continuation slice should repeat it in evidence and verification.
- Evidence: S19, S21, and S23 dogfood reports.

### M3 No Next Artifact Can Be A Normal Stop

- Lesson: absence of `nextArtifactPath` can be a successful stop reason, not a
  failure, when the current artifact completed and no deterministic successor
  exists.
- Evidence:
  `references/operations/sequential-ceo-autopilot-s23-post-accept-status-report.json`.

### M4 Stale Base Is Blocked Evidence

- Lesson: stale-base conditions should be reported as blocked evidence instead
  of silently rebasing, cherry-picking, or rerunning.
- Evidence:
  `references/initiatives/sequential-ceo-autopilot-s17-post-run-lifecycle-boundary.md`
  and `references/operations/sequential-ceo-autopilot-s19-run-accept-preflight-report.md`.

### M5 Accepted-Path Fixtures Are Valuable

- Lesson: an accepted-path fixture can disappear after accept cleanup. Preserve
  enough durable operation evidence before relying on it for later dogfood or
  review.
- Evidence:
  `references/operations/sequential-ceo-autopilot-s21-accept-run-once-report.md`
  and S23 operation JSON reports.

### M6 Dogfood Reports Need Full Lifecycle Evidence

- Lesson: dogfood reports should record command, run log, candidate commit,
  side effects, lifecycle trajectory, and verification output.
- Evidence:
  `references/operations/sequential-ceo-autopilot-s23-dogfood-report.md`.

### M7 Blocked CLI Paths Must Prove No Mutation

- Lesson: blocked CLI-path tests should prove both the blocked report and that
  the input artifact was not mutated.
- Evidence:
  `references/tasks/sequential-ceo-autopilot-s22-post-accept-status-rework.json`
  and `references/initiatives/sequential-ceo-autopilot.md`.

### M8 Cross-Review Finds Ordering And Visibility Gaps

- Lesson: report-only cross-review is especially effective at finding
  validation-order bugs and visibility gaps before routine execution.
- Evidence: S9.1 and S22 correction evidence.

### M9 Say No S25 Explicitly

- Lesson: closure should say "No S25" or equivalent when the roadmap ends, so
  the initiative does not keep absorbing adjacent authority work.
- Evidence: `references/initiatives/sequential-ceo-autopilot.md`.

## Low Priority Lessons

### L1 Tiny Operation Markdown Workers Are Useful Fixtures

- Lesson: operation-markdown-only tiny workers can be useful lifecycle dogfood
  fixtures because they exercise the harness without broad implementation
  risk.
- Evidence: S23 dogfood evidence.

### L2 Docs-Only Dogfood Still Needs Deterministic Checks

- Lesson: source/test-free docs dogfood should still preserve JSON parsing,
  marker grep, readiness checks, and diff checks.
- Evidence: S14/S17 decision artifacts and reports.

### L3 Broader Routine Use Belongs In A Follow-Up Boundary

- Lesson: broader routine use, `batch_plan`, and multi-writer continuation
  should not be attached to the same MVP after single-writer closure.
- Evidence: S24 closure in `references/initiatives/sequential-ceo-autopilot.md`.

### L4 Candidate/Execution Naming Pattern Is Reusable

- Lesson: the `runTaskCandidate`/`runTaskExecution` and
  `runAcceptCandidate`/`runAcceptExecution` naming pattern is a useful
  reference for future action types.
- Evidence: S11, S14, S17, and S20/S21 evidence in the initiative.

### L5 Curated Incident Lessons Can Complement Recurrence Thresholds

- Lesson: keep recurrence thresholds for automatic lesson promotion, but allow
  high-confidence session synthesis to create a curated lesson candidate when
  evidence is concrete.
- Evidence: this candidate and the weak S8/S11 auto-generated lesson examples.

## Existing Weak Lesson Candidate Plan

Do not promote these two candidates as written:

- `references/lessons/inbox/2026-05-20T00-37-17-545Z-sequential-ceo-autopilot-s8-schema-example-correction.md`
- `references/lessons/inbox/2026-05-20T04-31-56-096Z-sequential-ceo-autopilot-s11-contract-field-correction.md`

They are useful as examples of bad lesson shape because the proposed lesson is
generic and does not state a concrete invariant, evidence, or target artifact.
A later lesson review may drop them or supersede them with this consolidated
candidate.

## Future Enforcement Candidates

This learning pass intentionally does not modify source or tests. These
invariants are candidates for future source/test enforcement templates when a
new action type reuses the continuation pattern:

- predecessor artifact validation must happen before optional field inspection;
- blocked CLI paths must prove no input-file mutation;
- side-effect maps must be exact authority contracts, not loose metadata.
