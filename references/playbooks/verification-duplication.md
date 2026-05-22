# Verification Duplication Boundaries

Status: advisory playbook
Source: verification duplication optimization boundary task, 2026-05-23

## Purpose

Reduce wasted worker effort around repeated verification without moving trust
from Samantha-owned verification into worker judgment.

This playbook defines planning vocabulary only. It does not change the
`TaskSpec` contract, run-log semantics, worker-result evaluation, verification
execution order, policy enforcement, or harness acceptance gates.

## Vocabulary

- `focused`: a check tied directly to the changed surface, usually one test file,
  one parser path, or one markdown-surface assertion.
- `broad`: a wider sanity check such as the full test suite or typecheck when the
  changed surface could affect shared behavior.
- `docs-surface`: a deterministic check for documentation-only work, such as
  markdown diff hygiene or required term presence.
- `policy-gate`: a check that proves a harness policy accepts and rejects the
  intended cases. Use this label only when policy behavior is in scope.

These labels help humans and agents plan evidence. They are not trusted fields,
not a replacement for `verifyCommands`, and not authority for workers to decide
which harness checks matter.

## Acceptance Boundary

Harness verification remains the acceptance gate. Existing `verifyCommands`
string arrays remain valid and authoritative for Samantha-owned verification.
Workers may run focused or otherwise applicable checks first to shorten their
own feedback loop, but the harness must still run the declared `verifyCommands`
before acceptance.

`WORKER_VERIFY_EVIDENCE` is advisory. It can disclose checks the worker ran,
checks it skipped, and broad checks it could not run before final response. It
must not be treated as proof that harness verification passed, and it must not
let a worker remove, reorder, downgrade, or waive declared `verifyCommands`.

Changing the `TaskSpec` contract from string arrays to structured verification
metadata requires explicit repeated run evidence plus focused tests proving the
new contract accepts and rejects the intended cases. Do not make that change
from terminology cleanup alone.

## Worker Guidance

For writer work, a worker may:

- run the most focused applicable check first
- run broader declared checks when practical before final response
- report skipped broad checks through `WORKER_VERIFY_EVIDENCE`
- mark `HARNESS_RESULT` as `rework` or `blocked` when required commands cannot
  be run or fail in a way the worker cannot resolve

A worker must not:

- decide which harness verify commands are authoritative
- remove declared verify commands from the task
- treat `WORKER_VERIFY_EVIDENCE` as completion evidence
- claim acceptance, commit, merge, cleanup, or lifecycle authority

## Slice 4 Boundary

Do not implement fail-fast verification or parallel verify execution from this
playbook. Those behavior changes require current run evidence and command
structure proving they are safe.

Evidence to review first:

- repeated runs where later verify commands add no useful failure information
  after an earlier failure
- command independence strong enough to make parallel execution safe
- no order-sensitive setup, generated files, cache mutation, or shared output
  assumptions between commands
- focused tests that prove failure reporting remains complete and auditable

Without that evidence, keep verification execution behavior unchanged.

## Slice 5 Guidance

Use run evidence review to tighten policy, prompts, templates, or playbooks only
when the repeated pattern is explicit and reviewable. Suitable evidence includes
multiple comparable run logs, repeated skipped-check disclosures, repeated
verification duplication that did not add signal, or repeated failures showing a
template asks for the wrong focused check.

Tightening may include clearer worker prompt language, task-template wording, or
playbook examples. It must not add hidden memory, trusted state changes,
automatic policy changes, daemon/watch behavior, routine triggers, dashboards,
or remote adapters.

Automatic policy or template changes require repeated run evidence, a named
target artifact, and focused tests for the changed behavior. If the evidence is
not strong enough, document the boundary and stop before behavior changes.
