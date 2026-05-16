# Initiative: SDK Adapter Samantha

Status: planned
Source: Samantha plan on 2026-05-16 after reviewing official Codex SDK, App
Server, and Remote Connections documentation.
Last updated: 2026-05-16

## Goal

Improve Samantha's worker execution performance, convenience, and continuity by
introducing a Codex SDK runtime adapter path while preserving Samantha-owned
task specs, worktree allocation, scope checks, deterministic verification, run
evidence, and commit/report authority.

The first useful outcome is not a new remote control plane. It is a safer
worker runtime boundary that lets Samantha keep the current `codex exec --json`
path while preparing an SDK-backed path for richer worker continuity and run
evidence.

## Source

- Official Codex SDK documentation:
  `https://developers.openai.com/codex/sdk`
- Official Codex App Server documentation:
  `https://developers.openai.com/codex/app-server`
- Official Codex Remote Connections documentation:
  `https://developers.openai.com/codex/remote-connections`
- Existing Samantha dispatch path:
  `src/core/codex-dispatch.ts`
- Existing Samantha worker execution path:
  `src/core/worker-dispatch.ts`
- Existing run evidence path:
  `src/core/run-log.ts`

## Problem

Samantha currently treats Codex mostly as a subprocess that receives a prompt and
returns text. That keeps the harness simple, but it makes several debut-era
pain points harder than they need to be:

- worker progress is coarse;
- failed worker runs are mostly recovered from final output, command status, and
  changed files;
- follow-up work cannot intentionally resume the same Codex thread;
- run logs cannot name the Codex thread or turn that produced the work;
- future runtime changes would touch dispatch code directly instead of passing
  through a stable adapter boundary.

## Accepted Decisions

- Use the official Codex SDK as the first runtime-adapter candidate for deeper
  Samantha/Codex integration.
- Keep `codex exec --json` as the baseline runtime until an SDK-backed path
  proves equal or better through tests and dogfood evidence.
- Treat official Remote Connections as an operator surface for BK convenience,
  not as Samantha-owned lifecycle state.
- Defer direct App Server integration until Samantha needs rich-client behavior
  that the SDK does not provide.
- Preserve Samantha's local evidence model. Codex thread state may enrich run
  logs, but it must not replace run logs, scope checks, verification, or
  lifecycle records.

## Non-Goals

- No Samantha-owned remote control plane.
- No daemon, watch service, dashboard, or routine trigger as part of this
  initiative.
- No direct App Server JSON-RPC client in the first implementation phase.
- No worker-owned orchestration.
- No automatic merge, cleanup, push, or policy mutation.
- No secret, connector, or credential expansion for workers.
- No replacement of task specs, run logs, `HARNESS_RESULT`, or deterministic
  verification with Codex thread history.

## Invariants

- Samantha owns task creation, worktree allocation, dispatch policy,
  deterministic verification, merge checks, commits, reports, cleanup, and
  lifecycle evidence.
- Workers may only do what their task spec and agent profile allow.
- Writer work still happens in Samantha-allocated worktrees.
- Changed files are still checked against declared target files and forbidden
  changes outside the worker's judgment.
- Verify commands still run outside the worker's judgment.
- SDK-provided thread, turn, event, or output data is evidence enrichment, not
  trusted state by itself.
- The existing `codex exec --json` path remains available as a fallback until a
  later reviewed decision removes it.

## S1+S2 ADR: Worker Runtime Adapter Boundary

Decision:

Introduce `WorkerRuntimeAdapter` as a narrow runtime boundary. The adapter owns
only worker prompt preparation, runtime-specific command construction, worker
invocation, and raw runtime stdout/stderr/exit-code capture. The first concrete
adapter is the existing `codex exec --json` subprocess path.

Authority that remains outside the adapter:

- Samantha-owned task specs and agent profiles define worker authority.
- `worker-dispatch` owns dispatch policy checks, unresolved placeholder
  rejection, worktree allocation, setup commands, baseline dirty-file capture,
  worker output evaluation, scope checks, deterministic verification, and
  Samantha-owned commit creation.
- Run logs, lifecycle records, report authority, merge checks, cleanup, and
  commit/push decisions remain Samantha-owned evidence and gates.

Non-decisions for this slice:

- No SDK dependency is installed.
- No App Server integration is added.
- No runtime selector is added.
- No run log schema change is made.
- No runtime adapter may accept, reject, verify, merge, commit, push, clean up,
  or mutate lifecycle state.

This boundary is decision-complete for extracting the current exec-json behavior:
the extraction does not require moving verification, scope checks, commits, or
lifecycle decisions into the adapter.

## Phase Plan

### Phase 0: Architecture Decision And Adapter Boundary

Objective:

Define exactly what a Samantha worker runtime adapter owns and what remains in
`worker-dispatch`.

Expected design:

- Introduce a conceptual runtime boundary such as `WorkerRuntimeAdapter`.
- The adapter owns worker invocation and raw runtime output.
- `worker-dispatch` continues to own setup commands, worktree selection,
  evaluation, verification, and Samantha-owned commit creation.
- The first concrete adapter remains the current exec-json implementation.

User benefit:

- BK gets a clearer maintenance path without destabilizing current Samantha
  execution.
- Future runtime changes become smaller and easier to review.

Samantha benefit:

- Dispatch code stops treating `codex exec --json` as the only possible runtime.
- Tests can prove the old behavior remains intact while the boundary is added.

Stop condition:

- Stop if the adapter boundary would move verification, scope checks, commits,
  or lifecycle decisions into the runtime adapter.

### Phase 1: Exec Runtime Adapter Extraction

Objective:

Extract the current subprocess behavior into an explicit exec runtime adapter
without changing user-visible behavior.

Expected implementation surface:

- `src/core/codex-dispatch.ts`
- `src/core/worker-dispatch.ts`
- focused tests around command construction and worker dispatch

Verification:

- `bun test tests/codex-dispatch.test.ts`
- `bun test tests/worker-dispatch.test.ts`
- `bun run typecheck`

User benefit:

- No workflow disruption.
- Samantha stays stable while internals become easier to improve.

Samantha benefit:

- Runtime-specific behavior becomes replaceable without rewriting policy,
  worktree, evaluation, or commit code.

Stop condition:

- Stop if this requires installing the SDK, changing task spec shape, or
  altering run log schema. Those belong to later phases.

### Phase 2: Run Evidence Schema For Runtime Metadata

Objective:

Add optional runtime metadata to run evidence before adding SDK execution.

Candidate fields:

- runtime kind: `exec-json` or `codex-sdk`;
- runtime thread id when available;
- runtime turn id when available;
- summarized event counts when available;
- runtime fallback reason when Samantha chooses exec-json.

Expected implementation surface:

- `src/core/contracts.ts` or a narrower run-runtime type file;
- `src/core/run-log.ts`;
- run log, ledger, readiness, or run-show tests only if they surface the new
  metadata.

Verification:

- focused run-log tests;
- `bun run typecheck`;
- broader `bun test` if shared run evidence behavior changes.

User benefit:

- BK can see which Codex runtime produced a run and whether it can be resumed or
  inspected later.

Samantha benefit:

- Later SDK runs have a place to store thread continuity without making thread
  state authoritative.

Stop condition:

- Stop if the schema change makes old run logs invalid or requires migration
  before there is a concrete reader benefit.

### Phase 3: SDK Capability Spike As Report-Only Evidence

Objective:

Prove what the Codex SDK can actually provide in Samantha's local environment
before using it for writer tasks.

Expected work:

- Install or vendor no dependency unless explicitly accepted in a task spec.
- Run a bounded report-only spike first.
- Answer these questions:
  - Can Samantha start a Codex thread with a prompt equivalent to the current
    worker prompt?
  - Can Samantha resume a thread by id?
  - What result shape is returned?
  - Are thread ids available reliably?
  - Can stdout-like final output still include `HARNESS_RESULT`?
  - What errors or approval states does the SDK surface?

Verification:

- report-only run evidence;
- no production code changes unless the spike is later promoted.

User benefit:

- BK avoids paying implementation cost for SDK assumptions that may not hold.

Samantha benefit:

- Adapter design is based on observed SDK behavior, not guesses from docs.

Stop condition:

- Stop if SDK behavior cannot preserve `HARNESS_RESULT`, worktree rooting,
  sandbox expectations, or deterministic post-run evaluation.

### Phase 4: SDK Runtime Adapter Behind An Explicit Option

Objective:

Add a guarded SDK-backed runtime path without changing the default runtime.

Expected implementation:

- Add an explicit runtime selector such as CLI flag, task/run option, or
  harness-level argument. Prefer the narrowest option that supports dogfood.
- Default remains exec-json.
- SDK runtime writes the same `WorkerDispatchExecution` shape or a deliberately
  extended shape accepted by tests.
- SDK runtime records optional runtime metadata from Phase 2.

Verification:

- unit tests using a fake SDK adapter;
- existing exec-json dispatch tests still pass;
- typecheck;
- one dogfood writer or report-only run only after unit tests pass.

User benefit:

- BK can try SDK-backed execution on bounded tasks without risking the normal
  Samantha path.

Samantha benefit:

- Runtime choice becomes testable and reversible.

Stop condition:

- Stop if SDK runtime cannot be faked in tests or if tests need real network,
  credentials, or an interactive approval path.

### Phase 5: Rework And Resume Semantics

Objective:

Use SDK thread continuity only where it gives clear value: failed run recovery
and bounded follow-up tasks.

Expected behavior:

- A failed or incomplete SDK-backed run may expose a resume candidate thread id.
- `tasks:from-run` or a future recovery path can include that thread id as
  context for a follow-up task.
- Rework still receives a narrowed task spec and fresh verification commands.

User benefit:

- BK gets fewer repeated explanations and faster recovery from failed work.

Samantha benefit:

- Recovery can preserve useful worker context without trusting failed worker
  output.

Stop condition:

- Stop if resume semantics encourage broad "continue working" prompts instead
  of bounded task specs.

### Phase 6: Promotion Or Rejection Decision

Objective:

Decide whether SDK-backed runtime should become a normal Samantha path.

Promotion evidence:

- SDK-backed runs preserve all existing gates.
- Run evidence is clearer than exec-json evidence.
- Recovery or follow-up work is measurably easier.
- Failures are diagnosable through Samantha evidence without relying on hidden
  Codex UI state.
- Exec-json fallback remains available until explicit removal is reviewed.

Rejection evidence:

- SDK adds dependency or operational cost without better evidence.
- SDK behavior is too hard to fake in tests.
- SDK output cannot preserve `HARNESS_RESULT` and deterministic evaluation.
- SDK thread state tempts Samantha to skip task specs or verification.

## App Server Hold Criteria

Do not start direct App Server integration unless at least one of these becomes
true:

- Samantha needs a dedicated rich client or dashboard that streams turn, item,
  command, file-change, and approval events.
- BK approval handling becomes a real bottleneck that SDK and official Remote
  Connections do not solve.
- SDK cannot expose thread or event metadata needed for run evidence.
- Samantha needs to manage Codex app-server protocol state directly for a
  reviewed product slice.

Even then, App Server remains a transport/runtime layer. It must not become the
source of truth for Samantha lifecycle decisions.

## Slice Queue

| Slice | Status | Objective | Depends on | Verification | Next prompt |
| --- | --- | --- | --- | --- | --- |
| S1 | completed | Turn this initiative into an ADR and adapter-boundary design. | none | `git diff --check HEAD -- '*.md' 'references/**/*.md'` | `sam p: references/initiatives/sdk-adapter-samantha.md 를 읽고 S1을 진행해. SDK Adapter ADR과 WorkerRuntimeAdapter boundary를 설계하되 구현은 하지 말고, Samantha authority invariants와 첫 구현 slice 성공 기준까지 정리해줘.` |
| S2 | completed | Extract current exec-json behavior behind the adapter boundary without changing behavior. | S1 | `bun test tests/codex-dispatch.test.ts`; `bun test tests/worker-dispatch.test.ts`; `bun run typecheck` | `sam c: references/initiatives/sdk-adapter-samantha.md 의 S2를 수행해. 현재 codex exec --json 경로를 exec runtime adapter로 추출하되 사용자-visible behavior는 바꾸지 말고 focused tests와 typecheck까지 완료해줘.` |
| S3 | completed | Add optional runtime metadata to run evidence. | S2 | focused run-log tests; `bun run typecheck`; broader `bun test` if shared evidence behavior changes | `sam c: SDK Adapter initiative S3를 수행해. run evidence에 optional runtime metadata를 추가하되 old run log compatibility와 Samantha-owned gates를 유지해줘.` |
| S4 | completed | Run a report-only SDK capability spike and record findings. | S3 | report-only evidence; no production writes unless separately approved | `sam r: SDK Adapter initiative S4를 수행해. 공식 Codex SDK가 Samantha worker prompt, thread id, resume, result output, HARNESS_RESULT, error/approval 상태를 어떻게 제공하는지 report-only로 검토해줘.` |
| S5 | completed | Implement guarded SDK runtime adapter behind an explicit option. | S4 plus explicit dependency decision | fake SDK adapter tests; existing exec-json tests; `bun run typecheck`; bounded dogfood run | `sam c: SDK Adapter initiative S5를 수행해. @openai/codex-sdk dependency 설치 또는 fake-only no-dependency slice 중 하나를 명시적으로 선택한 뒤, SDK runtime adapter를 explicit option 뒤에 추가하고 exec-json default와 fallback을 유지해줘.` |
| S6 | completed | Add rework/resume semantics for SDK-backed failed runs. | S5 | recovery-focused tests; dogfood failed-run recovery evidence | `sam c: SDK Adapter initiative S6를 수행해. SDK thread continuity를 failed-run recovery에만 bounded하게 연결하고, task spec과 verification gate를 유지하는 rework/resume 흐름을 구현해줘.` |
| S7 | completed | Decide whether to promote, retain as experimental, or reject SDK runtime. | S5 or S6 | report-only promotion review; documented decision | `sam r: SDK Adapter initiative S7을 수행해. S5/S6 evidence를 기준으로 SDK runtime을 normal path로 promote할지, experimental로 유지할지, reject할지 findings-first로 검토해줘.` |

## Current Next Slice

No next implementation slice is ready. The S7 decision keeps `codex-sdk` as an
explicit experimental runtime and keeps `exec-json` as the default. Live writer
and real failed-run recovery evidence now exist, but future SDK promotion still
needs repeated runtime-error diagnosability evidence and an explicit dependency
maintenance plan. The follow-up S8-S11 promotion and application plan is
tracked in `references/initiatives/sdk-adapter-promotion-plan.md`.

## 2026-05-16 SDK Verification Update

Completed:

- Added bounded SDK dogfood task specs:
  `references/tasks/sdk-writer-dogfood.json` and
  `references/tasks/sdk-failed-recovery-dogfood.json`.
- Ran a live SDK writer task:
  `runs/2026-05-16T05-12-54-588Z-sdk-writer-dogfood.json`.
- Accepted and cleaned writer commit
  `93974ae6d4606c85a835370846aec6e44b879961`.
- Ran a real SDK failed-run recovery source:
  `runs/2026-05-16T05-15-18-040Z-sdk-failed-recovery-dogfood.json`.
- Generated `references/tasks/sdk-failed-recovery-follow-up.json` with
  `tasks:from-run`; it preserved the failed verify command and included SDK
  thread id `019e2f35-d859-7502-8c09-56b364b0cf4b` only as optional context.
- Ran the generated SDK recovery follow-up:
  `runs/2026-05-16T05-16-42-812Z-sdk-failed-recovery-follow-up.json`.
- Accepted and cleaned recovery commit
  `1423d4ae1e07176a937567edaa0d997781acf83e`.

Verification:

- `bun test tests/task-template.test.ts tests/cli.test.ts` passed before live
  dogfood task execution.
- The SDK writer run passed with changed files limited to
  `references/initiatives/sdk-adapter-s7-writer-dogfood.md`, zero scope
  violations, passing verify commands, runtime kind `codex-sdk`, and SDK thread
  id `019e2f33-a8d0-7a33-be08-40eb9790f71d`.
- The SDK failed run failed only deterministic verification, changed only
  `references/initiatives/sdk-adapter-s7-failed-dogfood.md`, had zero scope
  violations, and recorded runtime kind `codex-sdk`.
- The generated recovery follow-up passed with changed files limited to
  `references/initiatives/sdk-adapter-s7-failed-dogfood.md`, zero scope
  violations, passing verify commands, runtime kind `codex-sdk`, and SDK thread
  id `019e2f37-2536-7160-a768-953e10feccd2`.

Status:

- `codex-sdk` is implemented as a guarded, explicit runtime and now has live
  report-only, writer, failed-run, and recovery-follow-up evidence.
- `exec-json` remains the default runtime.
- SDK is still not promoted to the default path because runtime-error
  diagnosability and dependency maintenance are not yet evidenced enough.

## 2026-05-16 S7 Update

Completed:

- Recorded the promotion decision in
  `references/initiatives/sdk-adapter-s7-decision.md`.
- Decided to retain `codex-sdk` as an explicit experimental runtime.
- Rejected normal-path promotion for now because live evidence is limited to one
  report-only SDK dogfood run and synthetic failed-run recovery evidence.
- Rejected full SDK removal because fake SDK tests and the live report-only
  dogfood run show the adapter can preserve Samantha-owned gates.

Verification:

- Reviewed S4 capability report:
  `references/initiatives/sdk-adapter-s4-report.md`.
- Reviewed S5 live SDK dogfood run:
  `runs/2026-05-16T04-48-50-868Z-fixture-report-reviewer.json`.
- Reviewed S5/S6 code and tests for runtime boundary, worker dispatch, and
  failed-run recovery semantics.
- `git diff --check -- references/initiatives/sdk-adapter-samantha.md references/initiatives/sdk-adapter-s7-decision.md`
  passed.

Decision changes:

- `exec-json` remains the default runtime.
- `codex-sdk` remains available only through the explicit experimental
  `run-task --runtime=codex-sdk` path.
- No App Server integration, broader runtime selector, run log schema change,
  lifecycle authority change, or default runtime promotion is introduced.
- Future promotion requires at least one bounded SDK writer run and one real
  failed SDK run recovered through `tasks:from-run` without weakening task
  specs, scope checks, deterministic verification, or lifecycle authority.

## 2026-05-16 S6 Update

Completed:

- Added bounded SDK resume context to `tasks:from-run` follow-up instructions
  for failed or incomplete `codex-sdk` runs with a runtime `threadId`.
- Kept `exec-json` follow-up task generation unchanged.
- Kept failed-run recovery centered on a narrowed task spec, declared target
  files, original forbidden changes, and fresh verify commands.
- Kept Samantha-owned verification, scope checks, commit/report authority,
  worktree allocation, and lifecycle decisions outside runtime resume state.

Verification:

- `bun test tests/task-from-run.test.ts` passed.
- `bun test tests/codex-dispatch.test.ts` passed.
- `bun test tests/worker-dispatch.test.ts` passed.
- `bun run typecheck` passed.
- `bun test` passed.
- Dogfooded `bun run samantha tasks:from-run` against a synthetic failed
  `codex-sdk` run log under `/tmp/samantha-s6-recovery-*`; the generated task
  included the SDK thread id as optional context, kept the failed verify command
  first, and did not include a broad "continue working" prompt.

Decision changes:

- SDK thread continuity is evidence context only. It may be carried into a
  follow-up task as an optional resume candidate, but the next task spec,
  current repository state, target files, and verify commands remain
  authoritative.
- `tasks:from-run` does not choose a runtime, resume a thread, dispatch a
  worker, merge, clean up worktrees, push, or mutate lifecycle state.
- No run log schema change, App Server integration, runtime selector change, or
  new SDK dependency was introduced in S6.

## 2026-05-16 S5 Update

Completed:

- Added `@openai/codex-sdk` as an explicit dependency.
- Added a guarded `codex-sdk` worker runtime adapter behind the explicit
  `run-task --runtime=codex-sdk` selector.
- Kept default worker execution on `exec-json`.
- Kept batch execution and report orchestration on the existing default runtime.
- Added fake SDK adapter coverage proving SDK runtime output still flows
  through Samantha-owned output evaluation, report-only scope checks, and commit
  gates.
- Ran one bounded report-only SDK dogfood run:
  `runs/2026-05-16T04-48-50-868Z-fixture-report-reviewer.json`.

Verification:

- `bun test tests/codex-dispatch.test.ts` passed.
- `bun test tests/worker-dispatch.test.ts` passed.
- `bun test tests/cli.test.ts` passed.
- `bun run typecheck` passed.
- `bun run samantha run-task references/tasks/fixture-report-reviewer.json --repo-root=/Users/byung/Documents/samantha --agent=references/agent-profiles/codex-reviewer.json --runs-dir=runs --runtime=codex-sdk` passed.

Dogfood evidence:

- Runtime kind: `codex-sdk`.
- SDK thread id: `019e2f1d-a638-78a2-95bf-f1e1d23fdd04`.
- Event counts included `thread.started`, `turn.started`, `item.started`,
  `item.completed`, and `turn.completed`.
- `HARNESS_RESULT` parsed as `pass`.
- Changed files, scope violations, verify results, and commit remained empty
  for the report-only run.

Decision changes:

- `codex-sdk` is available only through an explicit runtime selector.
- `exec-json` remains the default and fallback baseline.
- SDK thread id and event counts are optional evidence only; they do not affect
  verification, scope checks, commit eligibility, lifecycle transitions, or
  report authority.

## 2026-05-16 S4 Update

Completed:

- Recorded report-only SDK capability findings in
  `references/initiatives/sdk-adapter-s4-report.md`.
- Verified local environment facts: Node `v24.14.1`, Codex CLI `0.130.0`, npm
  `@openai/codex-sdk` latest `0.130.0`, and no local SDK installation.
- Generated local app-server TypeScript protocol files under `/tmp` only to
  inspect thread, turn, error, and approval surfaces.

Verification:

- `npm view @openai/codex-sdk version engines dist-tags dependencies --json`
  passed.
- `node -e "require.resolve('@openai/codex-sdk/package.json')"` failed as
  expected because the dependency is not installed.
- `codex exec --help` passed.
- `codex app-server --help` passed.
- `codex app-server generate-ts --out /tmp/samantha-codex-app-server-schema-*`
  passed.

Decision changes:

- S5 is blocked until BK explicitly accepts installing `@openai/codex-sdk` or
  asks for a fake-only no-dependency precursor.
- TypeScript SDK thread IDs are source-confirmed; turn IDs are not confirmed on
  the public TypeScript SDK event surface reviewed in S4, so `runtime.turnId`
  remains optional.
- App-server exposes richer turn IDs and approval request details, but direct
  App Server integration remains held by the initiative's App Server hold
  criteria.

## 2026-05-16 S3 Update

Completed:

- Added optional runtime metadata evidence for exec-json worker runs.
- Preserved old run log compatibility by keeping runtime metadata optional.
- Kept Samantha-owned scope checks, deterministic verification, commits, report
  authority, lifecycle evidence, and merge decisions outside the runtime
  adapter.

Verification:

- `bun test tests/run-log.test.ts` passed.
- `bun test tests/codex-dispatch.test.ts` passed.
- `bun test tests/worker-dispatch.test.ts` passed.
- `bun run typecheck` passed.
- `bun test` passed.

Decision changes:

- Runtime metadata is evidence only. It is not trusted state and does not affect
  verification, scope checks, commit eligibility, lifecycle transitions, or
  report authority.

## End-of-Session Update Rule

Before ending any session that works on this initiative, update this file with:

- completed or blocked slice status;
- verification commands and outcomes;
- accepted or rejected decision changes;
- newly discovered SDK, App Server, or Remote Connections constraints;
- the next `ready` slice and its next prompt.

If verification fails, mark the active slice `blocked` and name the recovery
action instead of pretending the next slice is ready.

## Completion Rule

This initiative is complete when Samantha has either:

- a promoted SDK-backed runtime path that improves continuity and run evidence
  while preserving all Samantha-owned gates; or
- a documented rejection decision explaining why the existing exec-json runtime
  should remain the only supported path for now.
