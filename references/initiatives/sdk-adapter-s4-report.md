# SDK Adapter S4 Report-Only Capability Spike

Date: 2026-05-16
Status: completed with live-run limitation

## Scope

S4 was a report-only capability spike. It did not install
`@openai/codex-sdk`, did not add an SDK runtime adapter, did not add a runtime
selector, and did not change run log schema or Samantha lifecycle authority.

The goal was to answer what can be known before writer implementation:

- whether the Codex SDK can start a thread with Samantha's worker prompt;
- whether it can resume a thread;
- what result shape it returns;
- whether thread and turn identifiers are available;
- whether `HARNESS_RESULT` can still be captured;
- what error or approval state is exposed.

## Evidence Sources

- Official Codex SDK documentation:
  `https://developers.openai.com/codex/sdk`
- Official Codex App Server documentation:
  `https://developers.openai.com/codex/app-server`
- Official Codex Remote Connections documentation:
  `https://developers.openai.com/codex/remote-connections`
- Open-source TypeScript SDK source:
  `https://github.com/openai/codex/tree/main/sdk/typescript`
- Local package metadata:
  `npm view @openai/codex-sdk version engines dist-tags dependencies --json`
- Local environment checks:
  `node -p "process.version"`, `codex --version`,
  `codex exec --help`, `codex app-server --help`
- Local app-server protocol generation under `/tmp`:
  `codex app-server generate-ts --out /tmp/samantha-codex-app-server-schema-*`

## Local Environment

- Node is `v24.14.1`, satisfying the SDK's Node 18+ requirement.
- Local Codex CLI is `codex-cli 0.130.0`.
- npm reports `@openai/codex-sdk` latest as `0.130.0` and dependent on
  `@openai/codex` `0.130.0`.
- `@openai/codex-sdk` is not installed in this repo.
- Because S4 explicitly forbids installing or vendoring a dependency unless
  accepted in a task spec, no live SDK run was executed.

## Findings

### Start Thread

The TypeScript SDK supports `new Codex().startThread()` and `thread.run(prompt)`.
Thread options include `workingDirectory`, `sandboxMode`, `model`,
`approvalPolicy`, `additionalDirectories`, network/web-search controls, and a
git repo check override.

For Samantha, this means the current worker prompt can be passed as the turn
input, and the allocated worktree can map to `workingDirectory`. This is
source-confirmed but not live-confirmed in this repo because the package is not
installed.

### Resume Thread

The TypeScript SDK supports `codex.resumeThread(threadId)`, and its README says
threads are persisted under `~/.codex/sessions`. The generated local app-server
schema also exposes `ThreadResumeParams` and `ThreadResumeResponse`.

For Samantha, a future SDK adapter can treat SDK thread IDs as optional recovery
evidence. They must not replace task specs, verification, scope checks, or
lifecycle records.

### Result Shape

The TypeScript SDK `run()` result is source-confirmed as:

```ts
{
  items: ThreadItem[];
  finalResponse: string;
  usage: Usage | null;
}
```

`runStreamed()` exposes structured events, including thread start, turn
completion/failure, item lifecycle events, and usage. Item types include agent
messages, reasoning, command execution, file changes, MCP tool calls, web
search, todo lists, and errors.

For Samantha, `finalResponse` is the likely source for `HARNESS_RESULT`, while
`items` and streamed event counts are useful optional run metadata.

### Thread And Turn IDs

The TypeScript SDK exposes `thread.id`, populated from a `thread.started` event.
That is enough for optional `runtime.threadId` evidence.

The TypeScript SDK source reviewed for S4 does not expose a turn ID in its
public `TurnStartedEvent` type. The generated local app-server v2 protocol does
include turn IDs in `Turn`, `TurnStartedNotification`,
`TurnCompletedNotification`, approval params, and error notifications.

For Samantha, `runtime.turnId` should stay optional. S5 should not require turn
IDs from the TypeScript SDK unless a live run proves they are available through
another stable surface.

### HARNESS_RESULT Preservation

The SDK returns the final agent message as `finalResponse`, and streamed
`item.completed` events include agent-message text. That should preserve
Samantha's existing prompt contract requiring exactly one `HARNESS_RESULT` line.

This remains not live-confirmed. S5 must prove with a fake SDK adapter first,
then with one bounded report-only or writer dogfood run after dependency
installation is explicitly accepted.

### Error And Approval State

The TypeScript SDK exposes:

- `turn.failed` with an error message;
- top-level stream `error` events;
- item-level statuses for command execution, file changes, MCP tool calls, and
  other tool surfaces;
- thread options for approval policy and sandbox mode.

The local app-server protocol exposes richer approval request parameters for
command execution and file changes, with thread ID, turn ID, item ID, command,
cwd, reason, proposed exec-policy amendments, and proposed network-policy
amendments.

For Samantha, the TypeScript SDK is likely enough for a runtime adapter if the
adapter only needs raw output, final response, thread ID, usage, and event
counts. If Samantha later needs rich approval routing, the app-server protocol
is the richer surface, but that remains outside the current initiative until
the App Server hold criteria are met.

## Answers To S4 Questions

| Question | Answer |
| --- | --- |
| Can Samantha start a Codex thread with an equivalent worker prompt? | Source-confirmed yes through `startThread()` + `run(prompt)`, with worktree rooting via `workingDirectory`. Not live-confirmed locally because the SDK is not installed. |
| Can Samantha resume a thread by id? | Source-confirmed yes through `resumeThread(threadId)`; app-server schema also supports thread resume. |
| What result shape is returned? | `run()` returns `items`, `finalResponse`, and `usage`; `runStreamed()` returns an async event stream. |
| Are thread ids available reliably? | Source-confirmed after `thread.started`; live reliability still needs a bounded installed-SDK run. |
| Are turn ids available reliably? | Not from the reviewed TypeScript SDK public event type; app-server v2 exposes turn IDs. Keep `turnId` optional. |
| Can stdout-like final output still include `HARNESS_RESULT`? | Likely yes through `finalResponse`, but S5 must prove it with tests and a bounded live run after dependency approval. |
| What errors or approval states does the SDK surface? | TypeScript SDK surfaces failed turns, stream errors, item statuses, approval policy inputs, and sandbox options. App-server exposes richer approval request details. |

## Decision

Do not start S5 as production implementation yet. The next implementation slice
requires an explicit dependency decision for `@openai/codex-sdk` or a narrower
fake-only design that deliberately defers live SDK dogfood.

Samantha authority invariants remain unchanged:

- runtime metadata is evidence only;
- task specs, worktree allocation, scope checks, deterministic verification,
  commits, reports, lifecycle records, and cleanup remain Samantha-owned;
- SDK thread state must not become a lifecycle source of truth.
