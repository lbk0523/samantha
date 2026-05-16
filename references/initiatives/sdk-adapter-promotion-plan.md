# SDK Adapter Promotion And Application Plan

Date: 2026-05-16
Status: planned
Source: `references/initiatives/sdk-adapter-s7-decision.md`

## Current State

`codex-sdk` is implemented as a guarded runtime behind the explicit
`run-task --runtime=codex-sdk` selector. `exec-json` remains the default.

The SDK path now has live evidence for:

- report-only execution;
- writer execution with a Samantha-owned commit;
- a real SDK-backed `verify_failed` run;
- `tasks:from-run` recovery that kept SDK thread continuity as optional context
  while preserving task specs, target files, forbidden changes, and verify
  commands;
- Samantha-owned accept, lifecycle, cleanup, and push outside the runtime
  adapter.

Promotion is still blocked by two evidence gaps:

- repeated SDK runtime error diagnosability from Samantha run logs;
- an explicit dependency/version maintenance policy for `@openai/codex-sdk`.

## Promotion Principle

Do not promote SDK because successful runs work. Promote it only if failure
diagnosis, dependency maintenance, rollback, and authority boundaries are also
clear.

Runtime adapters may own prompt preparation, runtime invocation, raw output
capture, and optional runtime metadata. They must not own task specs, worktree
allocation, verification, scope checks, commits, report acceptance, lifecycle
records, cleanup, push, orchestration, or learning promotion.

## S8: SDK Runtime Error Diagnosability

Objective:

Prove that SDK runtime failures are diagnosable from Samantha run logs without
hidden Codex UI state.

Scope:

- Add or strengthen fake SDK runtime coverage for:
  - `turn.failed`;
  - stream `error`;
  - thrown SDK/client exception.
- Verify each error path produces useful `WorkerDispatchExecution` evidence:
  - command exit code;
  - stderr message;
  - runtime kind;
  - thread id when available;
  - event counts when available;
  - no Samantha-owned commit when the runtime fails.
- Run one bounded live SDK runtime failure dogfood if it can be done without
  production writes.
- Do not change the default runtime.
- Do not add App Server integration.
- Do not change run log schema unless the current evidence is proven
  insufficient.

Success criteria:

- SDK runtime errors can be classified from run logs alone.
- Existing exec-json command construction, SDK success path, report-only
  dispatch, writer dispatch, and failed-run recovery still pass focused tests.
- Samantha-owned gates remain outside the runtime adapter.

Verification:

- `bun test tests/worker-dispatch.test.ts`
- `bun test tests/run-diagnose.test.ts`
- `bun run typecheck`
- `bun test` if shared behavior changes
- bounded live SDK runtime failure dogfood when safe

Stop condition:

- Stop if SDK runtime errors require hidden Codex UI state or direct App Server
  state to diagnose.
- Stop if diagnosing errors requires moving verification, scope checks, commit,
  lifecycle, or recovery decisions into the runtime adapter.

Ready prompt:

```text
sam c: SDK Adapter S8을 수행해. codex-sdk runtime error diagnosability를 Samantha run log만으로 검증 가능하게 만들고 보고해. turn.failed, stream error, thrown SDK/client exception의 fake coverage를 추가하거나 보강하고, 가능하면 production write 없는 bounded live SDK runtime failure dogfood를 1회 수행해. default runtime 변경, App Server 통합, run log schema breaking change, lifecycle authority 변경은 하지 마. 검증은 bun test tests/worker-dispatch.test.ts, bun test tests/run-diagnose.test.ts, bun run typecheck, 필요하면 bun test까지 수행해. 답변은 한국어로 해줘.
```

## S9: SDK Dependency And Version Maintenance Policy

Objective:

Define how Samantha will maintain `@openai/codex-sdk` before it becomes a
normal runtime dependency.

Scope:

- Record the dependency policy in a reviewable artifact.
- Decide whether SDK and CLI versions must stay pinned together.
- Define upgrade smoke tests.
- Define rollback criteria for SDK regressions.
- Define how often SDK upgrade checks should happen, if at all.
- Keep package versions unchanged unless the policy explicitly requires a
  checked update.

Success criteria:

- The repo has a clear SDK dependency/version maintenance policy.
- The policy names owner authority: Samantha may verify and document; BK must
  approve broader dependency strategy changes if they affect normal operation.
- The policy includes a small upgrade verification checklist.

Verification:

- `bun install --frozen-lockfile`
- `bun test tests/codex-dispatch.test.ts tests/worker-dispatch.test.ts`
- `bun run typecheck`
- `git diff --check`

Stop condition:

- Stop if SDK/CLI version coupling cannot be described in a stable local policy.
- Stop if dependency maintenance requires automatic update infrastructure or
  recurring jobs before BK approves that product surface.

Ready prompt:

```text
sam c: SDK Adapter S9을 수행해. @openai/codex-sdk dependency/version maintenance policy를 별도 reviewable artifact로 작성하고, SDK/CLI version coupling, upgrade smoke tests, rollback criteria를 명확히 해줘. package version 변경은 정책상 꼭 필요할 때만 하고, 자동 업데이트/recurring job/새 product surface는 추가하지 마. 검증은 bun install --frozen-lockfile, bun test tests/codex-dispatch.test.ts tests/worker-dispatch.test.ts, bun run typecheck, git diff --check를 수행해. 답변은 한국어로 해줘.
```

## S10: SDK Promotion Decision Refresh

Objective:

Use S8 and S9 evidence to decide the next SDK status.

Decision options:

- Keep experimental: `codex-sdk` remains explicit-only.
- Promote to preferred dogfood runtime: Samantha self-build tasks prefer SDK
  when explicitly selected by the operator/task, while CLI default remains
  `exec-json`.
- Promote to CLI default: `run-task` defaults to `codex-sdk`, with explicit
  `--runtime=exec-json` fallback.

Recommended path:

Promote to preferred dogfood runtime before considering CLI default promotion.
Default promotion should be last because it changes routine behavior for every
worker run.

Scope:

- Update the promotion decision document.
- Add a runtime status matrix:
  - default runtime;
  - allowed explicit runtimes;
  - fallback path;
  - rollback trigger;
  - evidence required for each status.
- Do not implement the chosen status change unless the decision explicitly
  remains documentation-only or BK separately asks for implementation.

Success criteria:

- The decision is explicit and evidence-based.
- The selected status has clear rollback criteria.
- Authority invariants are restated.

Verification:

- `git diff --check -- references/initiatives/*.md`
- optional `bun test tests/readiness.test.ts` if readiness wording changes

Stop condition:

- Stop if S8 or S9 is incomplete.
- Stop if the decision would require App Server integration, broader runtime
  selector work, or default behavior change without explicit BK approval.

Ready prompt:

```text
sam p: SDK Adapter S10을 수행해. S8 runtime error diagnosability evidence와 S9 dependency maintenance policy를 기준으로 codex-sdk를 experimental로 유지할지, preferred dogfood runtime으로 승격할지, CLI default로 승격할지 결정 문서를 갱신해줘. 구현은 하지 말고 runtime status matrix와 rollback criteria를 남겨줘. 답변은 한국어로 해줘.
```

## S11: Limited SDK Application

Objective:

Apply SDK according to the S10 decision without broad default promotion.

Expected first application:

Prefer SDK for Samantha self-build dogfood tasks only when the operator or task
explicitly selects it. Keep `exec-json` available and keep routine CLI default
unchanged unless S10 explicitly approved a default change.

Possible implementation surfaces:

- documentation and operator guidance for when to choose `--runtime=codex-sdk`;
- task templates or task authoring guidance that may mention SDK as an explicit
  dogfood option;
- optional CLI/report wording that makes current runtime visible before
  dispatch;
- never worker-owned runtime selection.

Do not include by default:

- batch/report orchestration runtime selector;
- automatic runtime fallback;
- App Server integration;
- default runtime switch;
- cleanup, lifecycle, verification, or scope authority changes.

Success criteria:

- SDK application scope is narrow, observable, and reversible.
- Operators can intentionally choose SDK for the intended dogfood surface.
- `exec-json` fallback remains explicit and tested.
- Existing tests and typecheck pass.

Verification:

- `bun test tests/codex-dispatch.test.ts`
- `bun test tests/worker-dispatch.test.ts`
- `bun test tests/cli.test.ts` if CLI wording or parsing changes
- `bun run typecheck`
- one bounded SDK dogfood run if behavior changes

Stop condition:

- Stop if applying SDK requires routine default promotion before S10 approves
  it.
- Stop if applying SDK to batch/report orchestration would require a new runtime
  selector architecture.
- Stop if application weakens Samantha-owned verification, scope checks,
  commits, reports, lifecycle, cleanup, or push authority.

Ready prompt:

```text
sam c: SDK Adapter S11을 수행해. S10 결정에 따라 codex-sdk를 제한된 dogfood 적용 범위에 반영하되, exec-json fallback과 Samantha-owned gates를 유지해줘. default runtime 변경, batch/report orchestration runtime selector, App Server 통합, lifecycle/verification/scope authority 변경은 하지 마. 변경 표면을 최소화하고 focused tests, typecheck, 필요 시 bounded SDK dogfood run까지 수행해. 답변은 한국어로 해줘.
```

## Suggested Order

1. S8 first. Promotion cannot proceed without runtime error diagnosability.
2. S9 second. Dependency/version policy must exist before normal-path use.
3. S10 third. Decide status from evidence, not preference.
4. S11 last. Apply only the selected, bounded status.

Skipping S8 or S9 and jumping to S11 would spend effort applying a runtime whose
failure and maintenance model is not yet settled.

