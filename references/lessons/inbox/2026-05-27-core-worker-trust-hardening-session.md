# Lesson Candidate: 2026-05-27 Core Worker Trust Hardening Session

## Source

- Source type: curated operator synthesis from the core worker execution trust
  hardening session on 2026-05-26 through 2026-05-27.
- Review note: This is raw learning data plus promotion candidates. It does not
  by itself change policy, code, tests, task templates, agent profiles, playbooks,
  lifecycle state, or authority boundaries.
- Promotion state: unreviewed candidate.

## Review Metadata

- Source run id: 2026-05-27-core-worker-trust-hardening-session
- Task id: core-worker-trust-hardening-session
- Task title: Core worker trust hardening session synthesis
- Run log: curated session synthesis; see source artifacts below
- Observed outcome: original five-slice trust hardening plan completed, while residual hardening needed separate tracking
- Suggested artifact type: playbook promotion candidate
- Superseded status: not detected
- Recurrence count: 3
- Promotion threshold: 2
- Recurrence outcome: repeated review loops from mixing original plan closure with residual hardening
- Proposed lesson: Separate bounded plan closure from residual hardening, and require an adversarial review matrix for authority-sensitive accept decisions.
- Affected layer: WORK-RULES.md, self-build task spec lifecycle, authority-sensitive run accept checklist
- Risk if adopted: if applied to routine low-risk tasks, the extra checklist could add process overhead; constrain it to authority-sensitive or long-running initiatives.

## Source Artifacts

- Source-of-truth report:
  `/Users/byung/Downloads/samantha_harness_analysis_and_codex_action_plan.md`
- Original five-slice task specs:
  `references/tasks/core-worker-noop-pass-gate.json`,
  `references/tasks/core-worker-sequential-verification.json`,
  `references/tasks/core-worker-verify-timeout.json`,
  `references/tasks/core-worker-verification-quality-preflight.json`,
  `references/tasks/core-worker-execution-dogfood-plan.json`
- Key accepted commits:
  `199661c8c473026d4283ea03573ab90a638177a6`,
  `c8d14fb375705a15e4fc5f4e18f7338d48843374`,
  `20742ca7dd4f19c38119660bebf9638fb8b79fa4`,
  `de4641bed144ffc70e665bcd736278f90329cc2e`,
  `812c7b24fc001545c9e39a9f08177a8940b2cdbb`,
  `9bdffcae00552a9d1eda86a48e5e352e71a9e609`
- Important run logs:
  `/Users/byung/Documents/samantha/runs/2026-05-26T07-13-27-163Z-core-worker-noop-pass-gate.json`,
  `/Users/byung/Documents/samantha/runs/2026-05-26T07-45-16-545Z-core-worker-sequential-verification.json`,
  `/Users/byung/Documents/samantha/runs/2026-05-26T07-50-10-425Z-core-worker-verify-timeout.json`,
  `/Users/byung/Documents/samantha/runs/2026-05-26T12-56-12-687Z-core-worker-verify-timeout-cleanup-current-main.json`,
  `/Users/byung/Documents/samantha/runs/2026-05-26T13-36-34-767Z-core-worker-verification-quality-preflight-rework-3.json`,
  `/Users/byung/Documents/samantha/runs/2026-05-26T13-58-21-332Z-core-worker-s4-residual-policy-hardening.json`
- Closure handoff:
  `/var/folders/x5/90bwy81n2b9gj8s1jcwjh91m0000gn/T/handoff-XXXXXX.md.cfa0pONO10`

## High Priority Lessons

### H1 Separate Plan Closure From Residual Hardening

- Invariant: once an accepted slice plan's stated success criteria are met,
  declare that plan complete and move newly discovered adjacent hardening into a
  separately named initiative. Do not keep reopening the original plan with
  source-of-truth residuals that were outside the accepted scope.
- Evidence: the original five-slice plan reached functional completion, but
  later source-of-truth reviews kept finding S4 residuals and timeout residuals,
  making the session feel like a loop even after the original criteria were met.
- Target artifact: `WORK-RULES.md` or an initiative-continuity playbook.

### H2 Authority-Sensitive Accept Needs An Adversarial Matrix

- Invariant: policy or authority-sensitive worker runs should not be accepted
  only from HARNESS_RESULT, changed-file scope, and passing tests. The accept
  review should also run or inspect a small source-of-truth adversarial matrix
  for the trust boundary being changed.
- Evidence: S4 policy runs passed the declared tests, but later review found
  shell-wrapper no-op bypasses and weak targetFiles-to-verifyCommands
  relationships. The residual hardening task added more explicit adversarial
  cases after the fact.
- Target artifact: self-build task spec lifecycle playbook or a run-accept
  checklist for authority-sensitive tasks.

### H3 Scope Narrowing Needs A Residual Ledger

- Invariant: when a source report is intentionally narrowed, every omitted
  source requirement should be recorded as accepted residual work, not silently
  forgotten or rediscovered during later reviews.
- Evidence: the timeout slice was intentionally narrowed to verify command
  timeout, while setup command timeout and worker runtime timeout remained
  outside scope. Later consistency reviews resurfaced them as unresolved issues.
- Target artifact: initiative closure checklist or `references/playbooks/core-worker-execution-dogfood.md`.

### H4 Verification Policy Should Prefer Allowed Families Over Shell Parsing

- Invariant: command-quality policy should prefer repo-specific allowed
  verification families over broad shell parsing or ever-growing deny-lists.
- Evidence: simple deny-list normalization caught `bash -lc true` but missed
  equivalent forms such as `/bin/bash -lc true`, `env bash -lc true`, and split
  shell flags until the residual hardening task.
- Target artifact: `src/core/policy.ts` tests and a policy authoring note.

### H5 Completion Evidence And Cleanup Debt Are Different

- Invariant: merged functional completion and lifecycle cleanup debt should be
  reported as separate states. Missing cleanup should not make a completed
  capability look functionally incomplete, but it should stay visible as
  operational debt.
- Evidence: verify-timeout cleanup and S4 rework-3 were merged but initially not
  cleaned because earlier stop conditions explicitly excluded cleanup. Reviews
  mixed functional completion with cleanup debt until they were separated.
- Target artifact: run-accept/cleanup operating guidance.

## Medium Priority Lessons

### M1 Test Discovery Must Match The Verification Claim

- Lesson: full-suite evidence is weaker when local main and isolated worker
  discover different test files. Ignored worktrees or stale local fixtures should
  not be included by the main `bun test` surface unless intentionally stated.
- Evidence: local review found ignored `worktrees/` tests could be discovered by
  `bun test`, while isolated worker runs reported the intended test universe.
- Target artifact: verification test discovery hygiene slice.

### M2 Desktop PATH Is Part Of Operator Evidence

- Lesson: when Codex Desktop's PATH lacks `bun`, Samantha commands may fail
  before the harness starts. The operator should distinguish pre-harness PATH
  failures from worker run failures.
- Evidence: one `bun run samantha run-task ...` invocation failed because the
  package script re-entered `bun` without `/opt/homebrew/bin` in PATH; rerunning
  with PATH corrected produced the real worker run.
- Target artifact: operator troubleshooting note or command wrapper guidance.

## Low Priority Lessons

### L1 Curated Session Candidates Beat Automatic Vague Candidates

- Lesson: long sessions that mix planning, worker runs, review, rework, and
  closure should produce a curated lesson candidate only when concrete
  invariants, evidence, and target artifacts can be named.
- Evidence: this session produced reusable operating invariants, while generic
  "preserve task shape" lessons would have been too vague to promote.
- Target artifact: learning trigger policy or lesson review guidance.

## Suggested Review Outcome

- Review H1, H2, and H3 first. They directly reduce repeated review loops.
- Keep H4 as policy/testing guidance unless another command-quality issue
  recurs.
- Keep M1 and M2 as operational hygiene unless they repeatedly block work.
