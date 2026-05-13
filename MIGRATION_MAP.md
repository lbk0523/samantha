# Historical Migration Notes

Last updated: 2026-05-13

The migration from `samantha-codex` into the current Samantha harness is
complete. This file is historical context, not active task guidance and not a
source of product restrictions.

Use the current direction documents for active work:

- `AGENTS.md`
- `README.md`
- `NORTH_STAR.md`
- `ARCHITECTURE.md`
- `LEARNING_ARCHITECTURE.md`

## Carried Forward During Migration

These old modules shaped the initial harness core because they already matched
the scoped Codex-task loop:

| Old file | Reason it was useful |
| --- | --- |
| `src/lib/contracts.ts` | Task, agent, policy, and harness result shapes were a good starting contract. |
| `src/lib/harness-result.ts` | Small parser with clear failure behavior. |
| `src/lib/policy.ts` | Writer/non-writer and blocked-skill safety checks were useful. |
| `src/lib/git.ts` | Thin git wrapper used by worktree and result evaluation. |
| `src/lib/worktree.ts` | Per-task worktree allocation is central to the harness. |
| `src/lib/codex-dispatch.ts` | Codex prompt and command construction were directly relevant. |
| `src/lib/worker-result.ts` | Scope and verification evaluation are core harness logic. |
| `src/lib/worker-dispatch.ts` | Dispatch, setup, live command capture, evaluation, and Samantha-owned commit were core. |
| `src/lib/run-log.ts` | JSON run log contract is useful audit evidence. |
| `src/lib/ledger.ts` | Compact run indexing remained useful while it stayed simple. |
| `src/lib/merge-gate.ts` | Merge should remain explicit and deterministic. |
| `src/lib/worktree-cleanup.ts` | Cleanup belongs after merge and lifecycle gates. |

Matching tests were carried forward where they still matched the current code.

## Rewritten During Migration

Some ideas were kept but reshaped for the current local harness:

| Area | Kept idea | Current shape |
| --- | --- | --- |
| CLI | local operator commands | explicit `run-task`, run inspection, merge, accept, cleanup, diagnose, lesson, and task-generation commands |
| project profiles | repo defaults and verify defaults | task specs and agent profiles first; richer project config later if needed |
| reports | concise user-facing result summaries | local CLI and run-log summaries |
| live logs | command progress evidence | ordered trajectory entries in run logs |
| dashboard | read-only inspection | postponed until run logs and summaries justify it |

## Left Behind During Migration

The initial harness did not carry forward broad control-plane implementation
surfaces such as:

- `src/samantha.ts`
- Telegram adapters
- remote command adapters
- CEO turn stores
- dashboard implementation
- daemon/watch services
- routine trigger stores
- cost budget audit code
- host migration scripts

This list records what happened during migration. It does not prohibit future
work. Any future adjacent surface should be justified against the current
responsibility model and added through a reviewed task.

## Historical Documentation

Old `samantha-codex` docs were treated as context during migration, not as
active requirements:

- `docs/ARCHITECTURE.md`
- `docs/DETERMINISTIC_CEO_OFFICE.md`
- `docs/NORTH_STAR.md`
- `docs/CEO_OFFICE_ROADMAP.md`
- `docs/REMOTE_ADAPTERS.md`
- `docs/Samantha_v2_Phase1.md`
- `docs/legacy/REMOTE_AUTOPILOT.md`

The current repo owns its own README, architecture, north star, learning model,
task templates, agent profiles, policy, tests, and run evidence.
