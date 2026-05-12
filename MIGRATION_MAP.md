# Migration Map

Last updated: 2026-05-12

This map decides what should be reused from `samantha-codex` when starting the
new Samantha harness.

## Carry Forward First

These modules are close to the new harness core and have focused tests:

| Existing file | Why reuse |
| --- | --- |
| `src/lib/contracts.ts` | Task, agent, policy, and harness result shapes are a good starting contract. |
| `src/lib/harness-result.ts` | Small parser with clear failure behavior. |
| `src/lib/policy.ts` | Writer/non-writer and blocked-skill safety checks are useful. |
| `src/lib/git.ts` | Thin git wrapper used by worktree and result evaluation. |
| `src/lib/worktree.ts` | Per-task worktree allocation is central to the new harness. |
| `src/lib/codex-dispatch.ts` | Codex prompt and command construction are directly relevant. |
| `src/lib/worker-result.ts` | Scope and verification evaluation are core harness logic. |
| `src/lib/worker-dispatch.ts` | Dispatch, setup, live command capture, evaluation, and Samantha-owned commit are core. |
| `src/lib/run-log.ts` | JSON run log contract is useful audit evidence. |
| `src/lib/ledger.ts` | Compact run indexing can be kept if it stays simple. |
| `src/lib/merge-gate.ts` | Keep after MVP, because merge should remain explicit and deterministic. |
| `src/lib/worktree-cleanup.ts` | Keep after merge gate, not in the first slice. |

Carry the matching tests with them:

- `tests/harness-result.test.ts`
- `tests/policy.test.ts`
- `tests/worktree.test.ts`
- `tests/codex-dispatch.test.ts`
- `tests/worker-result.test.ts`
- `tests/worker-dispatch.test.ts`
- `tests/run-log.test.ts`
- `tests/ledger.test.ts`
- `tests/merge-gate.test.ts`
- `tests/worktree-cleanup.test.ts`

## Rewrite Instead Of Copying

These ideas are useful, but the current code is too coupled to the old control
plane:

| Area | Keep the idea | Rewrite target |
| --- | --- | --- |
| CLI | local operator commands | small `run-task`, `inspect-run`, `merge-check` commands |
| project profiles | repo defaults and verify defaults | minimal per-project config file |
| reports | concise user-facing result summaries | plain local CLI reports, no Telegram format |
| live logs | command progress evidence | optional JSONL stream after core MVP |
| dashboard | read-only inspection | postpone until run logs are stable |

## Do Not Carry Forward

Do not migrate these into the first new repo:

- `src/samantha.ts`
- `src/lib/telegram-adapter.ts`
- `src/lib/telegram-reply-adapter.ts`
- `src/lib/remote-command.ts`
- `src/lib/operator-reports.ts`
- `src/lib/ceo-turn-store.ts`
- `src/lib/ceo-report-store.ts`
- `src/lib/ceo-status.ts`
- `src/lib/operating-surface.ts`
- `src/lib/dashboard.ts`
- `src/lib/daemon.ts`
- `src/lib/routine-trigger-store.ts`
- `src/lib/queue-pressure.ts`
- `src/lib/cost-budget-audit.ts`
- `src/lib/backup-restore.ts`
- `ops/systemd/*`
- `ops/launchd/*`
- Telegram, remote, CEO-turn, daemon, dashboard, routine, budget, and host
  migration tests

These may still be mined later, but copying them early would bring back the old
product direction.

## Documentation Treatment

Treat old docs as historical context, not as active requirements.

Reference only:

- `docs/ARCHITECTURE.md`
- `docs/DETERMINISTIC_CEO_OFFICE.md`
- `docs/NORTH_STAR.md`
- `docs/CEO_OFFICE_ROADMAP.md`
- `docs/REMOTE_ADAPTERS.md`
- `docs/Samantha_v2_Phase1.md`
- `docs/legacy/REMOTE_AUTOPILOT.md`

Do not port phase history. The new repo should have its own short README and
task-focused architecture note.

## Extraction Rule

Every migrated module must satisfy this rule:

```text
It helps run, verify, record, or gate a scoped Codex task.
```

If a module mainly helps remote UX, continuous operations, conversation memory,
or broad CEO-office state, leave it behind.

