# Implementation Plan

Last updated: 2026-05-12

This is the recommended zero-base plan for the next Samantha harness.

## Phase 0 - Repo Contract

Goal: create the new repo with a narrow mission.

Deliverables:

- `README.md` states that Samantha is a Codex development harness.
- `AGENTS.md` forbids Telegram, daemon, remote command, and CEO-office scope in
  the first MVP.
- `package.json`, `tsconfig.json`, and test runner are minimal.
- `references/agent-profiles/codex-worker.json` exists.
- `references/tasks/fixture-single-writer.json` exists.

Verify:

```bash
bun run typecheck
bun test
```

## Phase 1 - Contracts And Parser

Goal: define the smallest task and result contract.

Carry or rewrite:

- `contracts.ts`
- `harness-result.ts`
- `policy.ts`

Acceptance:

- parse valid `HARNESS_RESULT`
- reject missing or malformed `HARNESS_RESULT`
- reject writer tasks without target files
- reject non-writer tasks that request write behavior
- keep writer cap at one

## Phase 2 - Worktree And Codex Command

Goal: prepare isolated execution without running a full worker yet.

Carry or rewrite:

- `git.ts`
- `worktree.ts`
- `codex-dispatch.ts`

Acceptance:

- allocate a per-task worktree
- reuse only a clean matching worktree
- reject dirty or mismatched worktrees
- build a `codex exec` command with the correct sandbox
- prompt includes target files, forbidden files, verify commands, and final
  `HARNESS_RESULT` requirement

## Phase 3 - Worker Evaluation

Goal: judge worker output deterministically.

Carry or rewrite:

- `worker-result.ts`

Acceptance:

- read changed files from committed and uncommitted state
- reject files outside `targetFiles`
- reject files matching `forbiddenChanges`
- run every `verifyCommand`
- pass only when harness status, scope, and verification all pass

## Phase 4 - End-To-End Task Run

Goal: run one task from fixture to committed output.

Carry or rewrite:

- `worker-dispatch.ts`
- `run-log.ts`

Add CLI:

```bash
bun run samantha run-task references/tasks/fixture-single-writer.json --repo-root=.
```

Acceptance:

- setup commands run before Codex
- Codex command is recorded
- evaluation is recorded
- Samantha creates the commit after gates pass
- run log is written under `runs/`
- failed verification or scope violation writes a failed run log and creates no
  commit

## Phase 5 - Inspection And Merge Gate

Goal: inspect runs and explicitly decide integration.

Carry or rewrite:

- `ledger.ts`
- `merge-gate.ts`

Add CLI:

```bash
bun run samantha runs:list
bun run samantha runs:show <run-id>
bun run samantha merge:check --run-log=<path> --repo-root=<repo>
```

Acceptance:

- show latest runs without reading raw JSON
- classify mergeable, already merged, stale base, dirty repo, failed
  verification, and missing commit
- do not push or cleanup in this phase

## Phase 6 - Cleanup And Recovery Later

Only after the first five phases are useful:

- add worktree cleanup
- add retry/finalize commands
- add report-only non-writer roles
- add project profile defaults
- consider a local dashboard

Do not add Telegram or 24/7 daemon behavior until the local harness is clearly
valuable.

## First Session Prompt

Use this prompt when starting the new repo:

```text
You are in the new Samantha harness repository.

Goal:
Build the first zero-base Samantha harness MVP: scoped task spec -> isolated
worktree -> Codex command preparation -> HARNESS_RESULT parsing -> deterministic
scope/verification evaluation -> Samantha-owned commit/report.

Read first:
1. README.md
2. AGENTS.md
3. references/tasks/fixture-single-writer.json
4. references/agent-profiles/codex-worker.json

Constraints:
- Do not implement Telegram, remote adapters, daemon/watch services, dashboard,
  CEO turn memory, routines, budget governance, or multi-project orchestration.
- Keep the CLI small.
- Port only the modules needed for the harness loop.
- Every behavior must have focused tests.

Start with:
1. Contracts and HARNESS_RESULT parser.
2. Dispatch policy tests.
3. Worktree allocation and Codex command preparation.

Verification:
- bun run typecheck
- bun test
```

