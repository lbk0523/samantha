# Initiative: Samantha Hook System

Status: S1-S5.7 implemented; worker.pre_dispatch runtime integration complete; first dogfood hook started
Source: Samantha hook-system planning discussion, 2026-05-23
Last updated: 2026-05-24

## Goal

Define the product and architecture plan for a Samantha-native hook system that
lets repositories add bounded automation around the existing Samantha loop
without weakening task specs, worker authority, scope checks, deterministic
verification, run evidence, or Samantha-owned lifecycle gates.

This document is the single source-of-truth plan for future hook work. It is not
a task spec and does not authorize implementation by itself.

## Product Principles

- Hooks are repository artifacts, not hidden memory or local machine state.
- V1 hooks are reviewed repo artifact commands, not an untrusted plugin sandbox.
- Hooks extend Samantha's loop; they do not replace Samantha's loop.
- Trust gates fail closed. Advisory helpers fail open and record evidence.
- Hook output is evidence or guidance, not authority by itself.
- Samantha core owns persistence. Hooks may emit structured results, but they do
  not write repository artifacts directly.
- The first version optimizes for auditability, small scope, and dogfood
  learning over general plugin flexibility.

## Accepted Decisions

- Hooks are repo artifacts stored and reviewed with the repository.
- The hook schema is Samantha-native instead of generic MCP, shell-plugin, or
  external workflow schema.
- Failure behavior is mixed:
  - trust-gate hooks fail closed;
  - advisory hooks fail open and record their failure in run evidence.
- Context injection is allowed, with explicit size and source boundaries. This
  controls what Samantha sends to hooks; it is not a repository file-read
  sandbox.
- Hooks must not write repo, source, task, profile, policy, or docs files. V1
  enforces this as mutation evidence and trust-gate fail-closed behavior, not as
  a complete pre-execution write sandbox.
- If hook output needs persistence, Samantha core owns recording it in run
  evidence instead of letting hooks write files.
- Raw stdout is retained during the initial one-week dogfood period, then
  reconsidered with run evidence.
- MCP is a separate future capability after the hook system proves its local
  artifact model.

## Non-Goals

- No Telegram, remote adapters, daemon/watch services, dashboards, CEO-office
  memory, routines, budget governance, or multi-project orchestration.
- No worker-owned orchestration, delegation, merge, cleanup, commit, push,
  policy, doctrine, lifecycle, or promotion authority.
- No hook authority to mutate repository files, task specs, agent profiles,
  policy files, docs, source files, run logs, or lifecycle records.
- No OS-level read sandbox, strict repository file-read allowlist, general
  plugin marketplace, or MCP server integration in the first version.
- No hidden learning, automatic promotion, or automatic policy rewrite.
- No replacement of task specs, `HARNESS_RESULT`, scope checks, deterministic
  verification, run logs, or Samantha-owned commits.

## Samantha Loop Insertion Points

Hooks may attach only to named Samantha loop events:

```text
minimal user goal
-> request classification hooks
-> Samantha CEO decomposition
-> task-spec draft hooks
-> task-spec preflight hooks
-> isolated worktree allocation
-> worker pre-dispatch hooks
-> Samantha worker run
-> HARNESS_RESULT capture
-> worker result hooks
-> deterministic verification
-> verification result hooks
-> Samantha-owned commit/report
```

The default first implementation should start with report-only or advisory
events, then add trust-gate events only after schema and run evidence are stable.

## Event Model

Hook events should be closed-schema names owned by Samantha:

- `request.classified`: advisory review after Samantha classifies a user request.
- `task_spec.drafted`: advisory review before a task spec is considered ready.
- `task_spec.preflight`: trust gate before dispatch eligibility.
- `worker.pre_dispatch`: trust gate after worktree and task inputs are known.
- `worker.completed`: advisory analysis after `HARNESS_RESULT` is captured.
- `verification.completed`: advisory analysis after deterministic checks run.
- `run.completed`: advisory summary before final report evidence is closed.

Each event should carry a stable run id, repository root, task id when present,
event name, event version, and a bounded context object.

## Event Permissions

| Event | First-version injected boundary | Failure behavior |
| --- | --- | --- |
| `request.classified` | Receive bounded injected context, emit advisory result | Fail open |
| `task_spec.drafted` | Receive bounded injected context, emit advisory result | Fail open |
| `task_spec.preflight` | Receive bounded injected context, emit allow/block result | Fail closed |
| `worker.pre_dispatch` | Receive bounded injected context, emit allow/block result | Fail closed |
| `worker.completed` | Receive bounded injected context, emit advisory result | Fail open |
| `verification.completed` | Receive bounded injected context, emit advisory result | Fail open |
| `run.completed` | Receive bounded injected context, emit advisory result | Fail open |

These entries describe injected context and authority-bearing output only. V1
hook commands execute as reviewed repository commands from the repository root
cwd. Samantha does not technically prevent those commands from opening other
repository files in V1.

Hooks must not write repository files. File writes outside the repository are
also out of scope for the first version except process-local temporary files
created by the hook command and discarded by the command itself.

## Context Injection Boundary

Context injection is allowed because hooks need structured facts to be useful
without scraping repository state. The boundary is:

- Samantha selects the context fields.
- Samantha caps the serialized context size.
- Samantha records which context keys were provided.
- Hooks receive context as structured stdin input while the command runs from
  the repository root cwd for predictable relative paths.
- Hooks may not request additional authority from inside the run.
- Hooks may not persist injected context except by returning structured output
  that Samantha chooses to include in run evidence.

Sensitive fields, credentials, connector data, hidden memory, and arbitrary
transcripts are not valid context sources for the first version.

## File Read Boundary

V1 separates context injection from file reads. Samantha chooses and caps the
structured context sent to hooks, but hook commands run as local subprocesses
from the repository root and are not enclosed in an OS-level read sandbox or
strict file-read allowlist.

The MVP relies on reviewable hook artifacts, narrow hook definitions, bounded
injected context, stdout caps, status and decision validation, timeout-bounded
completion, mutation evidence, and run evidence. A technical read sandbox or
repository file-read allowlist is a future capability if dogfood evidence shows
it is needed.

## Current S1-S5.7 Guarantees

The current implementation guarantees the local Samantha-native hook policy,
runner, evidence, and first runtime insertion point:

- hook policy loading from `references/hooks/hook-policy.json` with referenced
  definitions under `references/hooks/hooks/`;
- advisory runner core with fail-open evidence;
- trust-gate runner core for `task_spec.preflight` and `worker.pre_dispatch`
  with fail-closed allow/block behavior;
- bounded injected context for hook runner calls;
- hook commands run from the actual worker cwd/worktree path used for the event;
- timeout-bounded completion with SIGTERM/SIGKILL escalation;
- capped stdout;
- parsed status and decision validation;
- repository mutation evidence, with trust-gate mutation evidence treated as
  fail closed;
- optional run-log hook evidence support, including policy and definition
  digests, event evidence, invocation evidence, context keys, context bytes,
  stdout/stderr caps, timeout details, schema violations, and repo mutation
  evidence;
- `worker.pre_dispatch` runtime integration in `run-task` worker dispatch.

`worker.pre_dispatch` trust-gate hooks are automatically executed by `run-task`
worker dispatch after `prepareWorkerDispatch` succeeds and after worktree
allocation and Codex/runtime preparation, but before `setupCommands` and before
`runtimeAdapter.execute`.

The hook policy is loaded from the actual worker cwd/worktree path, not from a
separate controller-only path. A missing hook policy preserves existing dispatch
behavior and omits noisy `hookEvidence`. A present disabled policy, enabled
policy, or invalid policy produces diagnosable hook evidence where practical;
invalid present policy fails closed before worker execution.

`task_spec.preflight` runtime integration, advisory runtime hooks, CLI flags,
MCP, read sandboxing, plugin behavior, daemon/watch behavior, and remote
behavior remain future capabilities and are not implemented.

## Repo Artifact Structure

Repository artifact shape:

```text
references/hooks/
  hook-policy.json
  hooks/
    <hook-id>.json
```

Intent:

- `hook-policy.json` defines which hook ids may run for which events.
- `hooks/<hook-id>.json` defines one hook command and its declared behavior.
- Hook artifacts are reviewable repo files and must pass ordinary scope and
  verification gates when changed.

This path is now active for local hook policy loading and the first
`worker.pre_dispatch` dogfood gate.

## Schema Drafts

Hook definition draft:

```text
HookDefinition
- id: stable repository-local hook id
- version: schema version
- events: allowed Samantha event names
- command: argv-style command declaration
- purpose: short human-readable reason
- mode: advisory or trust_gate
- timeoutMs: per-hook timeout within global maximum
- contextKeys: explicit allowed context keys
- stdout: retention mode and cap
```

Hook policy draft:

```text
HookPolicy
- version: schema version
- enabled: true or false
- hooks: ordered hook references
- eventDefaults: default mode, timeout, and failure behavior per event
- disabledHooks: explicit temporary disables with reason
```

Hook result draft:

```text
HookResult
- hookId
- event
- status: passed, blocked, advisory_failed, timed_out, schema_invalid
- decision: allow, block, or none
- summary
- structuredFindings
- stdoutExcerpt
- startedAt
- finishedAt
- durationMs
```

Schema fields should stay small and closed. Free-form output belongs in capped
stdout evidence during dogfood, not in authority-bearing fields.

## Run Evidence Model

S1-S5 provides optional run-log shape and readers for hook evidence when
supplied. Once runtime dispatch integration supplies hook results, Samantha core
can record hook evidence alongside the existing run evidence:

- hook policy path and digest;
- hook definition paths and digests;
- event name and event version;
- injected context key list and serialized size;
- command cwd;
- timeout, duration, and SIGTERM/SIGKILL completion evidence when needed;
- exit status;
- parsed result status;
- allow/block decision for trust gates;
- advisory summary for advisory hooks;
- capped raw stdout during the one-week dogfood;
- repository mutation evidence;
- schema violation and timeout details when present.

Hook evidence enriches the run log. It must not replace `HARNESS_RESULT`,
changed-file scope checks, deterministic verification command output, lifecycle
records, or Samantha-owned commit/report evidence.

## Implementation-Before-Code Decisions

| Decision | Intent | Consequence | Recommendation |
| --- | --- | --- | --- |
| Hook policy reference location | Keep hook authority visible and reviewable. | Hook config changes become repo changes with normal review and scope gates. | Use `references/hooks/hook-policy.json` as the first policy location. |
| Command cwd | Make relative paths predictable and avoid per-hook path ambiguity. | Hooks that need another cwd must pass explicit paths instead of changing cwd. | Run hook commands from the repository root. |
| File read boundary | Keep context injection narrow without claiming process-level read enforcement. | V1 reviewed hook commands run from repo root and may technically read repository files. | Treat strict file-read allowlists or OS-level read sandboxing as a future capability if dogfood evidence justifies it. |
| Mutation boundary | Preserve the no-write product rule. | V1 records mutation evidence and trust-gate mutations fail closed; stronger hardening may be needed before broader dogfood or pre-dispatch reliance. | Keep hooks non-writing, and add pre-dispatch or dogfood hardening only as a separate implementation slice. |
| Timeout and default failure behavior | Bound latency while preserving trust gates. | Slow trust gates block; slow advisory hooks produce evidence but do not block. | Default to a small timeout, fail closed for trust gates, and fail open for advisory hooks. |
| Raw stdout cap | Preserve dogfood evidence without letting logs balloon. | Long outputs are truncated, so hooks must use structured summaries for important findings. | Keep capped raw stdout for one week; start with a conservative cap such as 16 KiB per hook result. |
| Context injection size cap | Keep prompts and subprocess input bounded. | Hooks may need narrower context rather than full run state. | Cap serialized context per hook; start conservatively and record actual sizes during dogfood. |
| Schema violation fail behavior | Keep authority-bearing output deterministic. | Invalid trust-gate results block even if the command exited successfully. | Treat schema violations as fail closed for trust gates and fail open with evidence for advisory hooks. |
| Run log compatibility | Avoid breaking existing run evidence readers. | Hook evidence must be optional until all readers understand it. | Add hook evidence as an optional additive section with stable event ids and no required changes to existing fields. |

## Complexity And Performance Limits

- First version should support a small ordered list of hooks per event, not a
  graph, retry policy, dependency system, or dynamic dispatch language.
- No hook retries in the first version.
- No parallel hook execution until serial behavior has dogfood evidence.
- Enforce per-hook timeout and total per-event timeout.
- Record hook runtime cost in run evidence.
- Stop before implementation if hook execution requires daemon/watch behavior,
  remote services, connector credentials, or worker-owned orchestration.

## First Dogfood Hook

Dogfood start: 2026-05-24.
One-week review: 2026-05-31.

The first real hook is
`worker-pre-dispatch-context-gate` at `worker.pre_dispatch`. Its purpose is to
prove the worker pre-dispatch context remains bounded to `task`, `agent`, and
`dispatch`, and to block if forbidden long/raw task context such as
`task.instructions` appears or if required bounded context is missing.

The gate is a Samantha-owned gate/evidence pipeline artifact. It is not an
extension platform, an untrusted plugin sandbox, a remote adapter boundary, or a
way for hooks to own lifecycle, commit, push, task-spec mutation, or worker
orchestration authority.

Stop conditions for this dogfood hook:

- disable or revert the hook if it blocks valid worker runs;
- disable or revert the hook if it adds unacceptable latency or log noise;
- disable or revert the hook if it produces confusing evidence;
- pause and design a separate slice if it reveals context shape drift that
  should not be handled inside the dogfood hook.

## One-Week Dogfood Criteria

The first dogfood period runs from 2026-05-24 through the 2026-05-31 review.

During dogfood, collect:

- number of hook invocations by event;
- timeout count;
- schema violation count;
- trust-gate blocks and whether they were correct;
- advisory failures and whether fail-open was acceptable;
- raw stdout usefulness versus log noise;
- context sizes and missing context requests;
- total hook runtime overhead per run.

After dogfood, decide whether to keep raw stdout, lower or raise caps, promote
or remove any event, and add focused policy checks.

## MCP Boundary

MCP is separate future capability after the local hook system. The hook system
must first prove:

- repository artifact policy is reviewable;
- Samantha-native schemas are stable enough for run evidence;
- mixed fail behavior works in real runs;
- context injection is useful without secret or connector expansion;
- hooks can enrich evidence without writing files.

Only after that evidence should Samantha consider MCP as an execution or
capability provider. MCP must not bypass hook policy, context boundaries,
Samantha-owned persistence, deterministic verification, or lifecycle gates.

## Implementation Slice Map

Future map only; do not treat these as task specs.

| Slice | Objective | Verification theme |
| --- | --- | --- |
| S1: Schema and policy plan | Finalize closed schemas and policy path. | Docs review and schema examples only. |
| S2: Policy loading | Load hook policy and definitions without executing hooks. | Focused parser and validation tests. |
| S3: Advisory hook runner | Execute one advisory event with context, timeout, and evidence capture. | Unit tests plus one dogfood run evidence check. |
| S4: Trust-gate hook runner | Add fail-closed allow/block handling for preflight events. | Tests for allow, block, timeout, and invalid schema. |
| S5: Run evidence integration | Add optional hook evidence to run logs and readers. | Backward compatibility tests and run-show checks. |
| S5.6: Trust-gate hardening | Bound trust-gate completion, stdout, and repo mutation behavior. | Tests for timeouts, caps, dirty baselines, and mutation blocks. |
| S5.7: Worker pre-dispatch runtime integration | Execute `worker.pre_dispatch` during `run-task` worker dispatch from the worker cwd/worktree path. | Run-task tests for missing, disabled, enabled, invalid, allow, and block evidence. |
| S5.8: First dogfood context gate | Add the first real `worker.pre_dispatch` trust gate under `references/hooks/**`. | Artifact load tests plus synthetic trust-gate tests for allow/block and no repo mutation. |
| S5.9: One-week dogfood review | Review 2026-05-24 through 2026-05-31 evidence and decide stdout, caps, events, and next constraints. | Report-only review artifact. |
| Later: MCP capability review | Decide whether MCP belongs behind hook policy. | Separate product and authority review. |

## Stop Conditions

Stop before implementation if the proposed hook design requires hooks to write
repository files, mutate task specs, change agent profiles, edit policy or docs,
own lifecycle state, dispatch workers, create worktrees, commit, push, use
remote adapters, run as a daemon/watch service, or replace deterministic
verification.

## Open Decisions

- Whether hook policy changes should require a dedicated policy-sensitive task
  family or ordinary docs/config verification.
- Which run evidence reader surfaces should display hook summaries first.
- Whether S5.9 dogfood evidence justifies changing stdout caps, timeout caps,
  context shape, or the first enabled events.
- Whether and how to implement `task_spec.preflight` runtime integration without
  expanding worker or lifecycle authority.
