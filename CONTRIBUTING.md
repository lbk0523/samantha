# Contributing

Samantha's first public release is clone-only. The project does not claim npm,
`bunx`, `npx`, package publishing, package-runner readiness, or package metadata
readiness yet.

## First-Release Scope

For the first release, maintainers may consider limited PR and issue activity in
these areas:

- `demo:first-run` bug reports with command output, `HARNESS_RESULT`, and
  deterministic verification details.
- documentation clarification for the trust loop, first-run demo, and
  public-versus-dogfood boundary.
- small trust loop improvements that preserve Samantha's existing authority
  model and can be verified deterministically.

This is not a general feature intake. Feature PRs are out of scope unless a
later reviewed initiative explicitly authorizes them.

## Required Boundaries

Contributions must preserve:

- task specs before execution;
- isolated worktrees for worker changes;
- explicit target-file and forbidden-file scope;
- deterministic verification outside worker judgment;
- `HARNESS_RESULT` as worker status evidence only;
- run evidence sufficient for review;
- Samantha-owned lifecycle transitions for accept, merge, cleanup, policy, and
  report authority.

Worker output, summaries, advisory notes, and thread evidence do not become
trusted state by themselves.

## Explicit Non-Goals

Do not open PRs or issues that attempt to add or promote these surfaces in the
first release:

- remote operation;
- background automation or background operation;
- dashboards or operator UIs;
- connector/control-plane entrypoints or other control-plane surfaces;
- budget governance;
- writer parallelism;
- multi-project orchestration;
- thread API automation;
- scheduler/daemon behavior;
- run-log schema expansion;
- CLI exposure beyond the reviewed first-run path;
- UI work;
- MCP integration;
- package-manager expansion;
- npm, `bunx`, `npx`, package publishing, package-runner, or package metadata
  claims.

`references/thread-control/**` is excluded from first public onboarding and
package contents by default. If mentioned, treat it as advanced dogfood/private
evidence, not as public setup or trusted acceptance evidence.

## Before Sending A PR

Keep changes narrow and reviewable:

- explain which first-release scope item the change serves;
- list changed files and why each one is needed;
- include deterministic verification commands and results;
- include relevant `HARNESS_RESULT` evidence when the change came from a worker
  run;
- avoid touching generated state, private dogfood evidence, or unrelated docs.
