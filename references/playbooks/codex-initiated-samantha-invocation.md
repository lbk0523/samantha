# Codex-Initiated Samantha Invocation

Use this playbook when Codex enters Samantha because workspace or repo policy
has classified a user request as Samantha-required, even though BK did not type
an explicit `Samantha <intent>:` or `sam <alias>:` command.

## Boundary

Policy-triggered invocation is an operator-proxy route. Codex may normalize the
request, draft or select a task spec, run Samantha's CLI, and report evidence on
BK's behalf. Codex must not treat this route as direct implementation
permission.

This route does not activate Sticky Samantha Session, project-global Samantha
mode, background operation, scheduled automation, thread-control authority,
worker-owned orchestration, hidden memory, automatic promotion, merge, cleanup,
push, or deployment authority.

## Preflight

1. Read the workspace `AGENTS.md`, target repo `AGENTS.md` when present, and the
   Samantha authority docs named by the request.
2. Classify the request as report-only, doctrine/architecture, docs-only writer,
   standard writer, rework, policy change, or recovery/lifecycle action.
3. If direct Codex work is allowed, say why and keep the change narrow.
4. If Samantha is required, name the target repo, harness repo, task-spec path or
   task-spec decision, target files, forbidden changes, verify commands, and
   stop conditions before dispatch.
5. If Samantha is required but unavailable, stop direct implementation and
   report the blocker unless BK explicitly approves a task-specific bypass.

## Dispatch Shape

Use the current workspace harness repo unless BK or reviewed config says
otherwise:

```bash
bun run --cwd /Users/byung/agent-workspace/repos/samantha samantha <args>
```

For writer work, the trusted path remains:

```text
task spec
-> isolated worktree
-> Samantha worker run
-> HARNESS_RESULT
-> deterministic verification
-> Samantha-owned commit/report
```

For Samantha self-build writer implementation, use the SDK-backed runtime gate
from `AGENTS.md` and `WORK-RULES.md`.

## Reporting

A Codex final report for policy-triggered Samantha invocation must include:

- target repo
- harness repo
- task spec path or task-spec decision
- run log or equivalent run evidence
- `HARNESS_RESULT`
- changed-file scope
- verification commands and outcomes
- candidate commit or report status
- lifecycle gates not completed
- any user approval still required, especially push, merge, deploy, cleanup, or
  policy relaxation

Do not present Codex Goal mode, subagents, manual thread control, background
thread summaries, or worker prose as Samantha completion evidence.
