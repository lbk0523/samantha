# Open Source First-Run Demo Brief

Date: 2026-05-31
Status: decision-complete brief
Source initiative: `references/initiatives/open-source-readiness.md`
Source audit: `references/operations/open-source-readiness-audit.md`

## Goal

Define the first public demo contract for Samantha's open-source release path.

The demo must let a new user experience the core trust loop without touching a
real project:

```text
install or clone Samantha
-> run one demo command
-> demo creates a disposable fixture repo
-> Samantha dispatches one bounded writer task
-> worker emits HARNESS_RESULT
-> deterministic verification runs
-> run log/report path is printed
-> cleanup path is explicit
```

This brief is not an implementation task spec. It fixes the product and
authority contract that a later implementation slice must follow.

## Accepted Decisions

- The first public demo should call a real Codex worker through Samantha's
  existing worker path. The trust loop is the product; a mock-only demo would
  not prove the core behavior.
- A dry-run or fixture-output mode may exist later only as documentation smoke
  testing. It must not be presented as proof that Samantha can verify real
  worker output.
- The first public form is clone/install plus one demo command. Package-runner
  distribution such as `bunx` is a later packaging slice after package metadata,
  license, and public docs are ready.
- The first demo command should be explicit and local: `demo:first-run`.
- Do not add a general `init` command for the first demo. `init` implies project
  adoption for arbitrary user repositories, which is out of scope for the first
  release.
- Do not add a separate `doctor` command in the first implementation slice.
  `demo:first-run` should perform the minimum preflight checks it needs and
  print actionable failures. A separate `doctor` command can be justified later
  if first-run evidence shows recurring environment failures.
- The demo must create or copy a fixture repository into a disposable generated
  path. It must not mutate the user's current repository or any private
  dogfood artifact.
- Demo artifacts should be inspectable by default. Cleanup should be explicit,
  not automatic, so the user can inspect run logs and worker output first.

## Demo Command Contract

Primary command:

```bash
bun run samantha demo:first-run
```

Allowed optional flags for the first implementation:

```bash
--demo-root=<path>
--keep
--runtime=codex-sdk|exec-json
```

Flag policy:

- `--demo-root` overrides the generated artifact root for debugging.
- `--keep` is the default behavior in spirit: preserve generated artifacts for
  inspection. If implemented as a flag, the no-flag behavior must still print
  cleanup instructions.
- `--runtime` may reuse existing worker runtime selection. If omitted, the
  current Samantha default applies.

Do not add these in the first implementation unless the implementation proves
they are required:

- `demo:init`
- `demo:doctor`
- `demo:cleanup`
- remote demo modes
- background/watch demo modes
- package publishing or installer behavior

## Fixture Repository Contract

Source fixture location:

```text
examples/first-run-demo/fixture-repo/
```

Generated demo root:

```text
.samantha-demo/<demo-id>/
```

Generated structure:

```text
.samantha-demo/<demo-id>/
  fixture-repo/
  worktrees/
  runs/
  task.json
```

Implementation requirements:

- `examples/first-run-demo/fixture-repo/` is a template only.
- `demo:first-run` must copy the fixture into `.samantha-demo/<demo-id>/fixture-repo/`
  before running Samantha.
- The copied fixture must be initialized as a git repository with a baseline
  commit before worker dispatch.
- `.samantha-demo/` must be ignored by git.
- The fixture should have no package dependencies. Its verification should use
  portable shell commands so first-run failures are about Samantha/Codex setup,
  not a demo app dependency tree.

Recommended fixture contents:

```text
README.md
demo-input.txt
```

The worker task should create exactly:

```text
demo-output.txt
```

Recommended task spec shape:

```json
{
  "id": "open-source-first-run-demo",
  "title": "Create the first-run demo output file",
  "taskFamily": "docs-only",
  "workMode": "minimal-change",
  "riskClass": "routine",
  "targetAgent": "codex-worker",
  "targetFiles": ["demo-output.txt"],
  "forbiddenChanges": ["README.md", "demo-input.txt", ".git/**"],
  "verifyCommands": [
    "test -f demo-output.txt",
    "grep -F \"Samantha first-run demo passed\" demo-output.txt"
  ],
  "instructions": "Create demo-output.txt containing the exact line: Samantha first-run demo passed. Do not edit any other file. End with exactly one HARNESS_RESULT line.",
  "expectedCommitSubject": "docs: add first-run demo output",
  "status": "pending"
}
```

The later implementation may generate this task spec at runtime instead of
committing it as a static file, but the generated task must be printed or saved
under the demo root so users can inspect what the worker was allowed to do.

## Expected Output Contract

On success, `demo:first-run` should print a compact summary with these fields:

```text
Samantha first-run demo: pass
demo id: <demo-id>
fixture repo: .samantha-demo/<demo-id>/fixture-repo
worker worktree: .samantha-demo/<demo-id>/worktrees/<task-id>
run log: .samantha-demo/<demo-id>/runs/<run-id>.json
HARNESS_RESULT: pass
verification: pass
candidate commit: <hash>
cleanup: rm -rf .samantha-demo/<demo-id>
```

The output must make clear that:

- the candidate commit is inside the disposable demo worker path;
- the demo did not merge into a user's real repository;
- the run log is local evidence for inspection;
- cleanup is safe after inspection.

On failure, output should still be structured enough for issue reports:

```text
Samantha first-run demo: blocked|failed
stage: preflight|fixture_setup|dispatch|worker|harness_result|verification|commit
reason: <short reason>
next action: <specific fix or report instruction>
demo id: <demo-id if created>
run log: <path if created>
cleanup: <path or none required>
```

## Safe Failure Paths

Preflight failures should stop before worker dispatch when possible.

Required preflight checks:

- Bun is available through the current execution path.
- The current repository can run the Samantha CLI entrypoint.
- Git is available.
- The fixture can be copied to a generated demo root.
- The generated fixture repo can be initialized and committed.
- The selected worker runtime is recognized.

Codex credential or runtime readiness:

- If a cheap deterministic SDK/runtime readiness check already exists by the
  time this slice is implemented, use it before dispatch.
- If no such check exists, let the worker runtime fail normally and report the
  stage as `dispatch` or `worker`, preserving any run log evidence.
- Do not add broad credential probing or secret inspection.

Verification failure:

- Keep the run log.
- Print the failed verify command.
- Do not mark the demo as pass even if the worker emitted
  `HARNESS_RESULT: pass`.

Malformed or missing `HARNESS_RESULT`:

- Keep the run log.
- Print that the worker output was rejected before trust.
- Do not create or report an accepted demo result.

Scope violation:

- Keep the run log.
- Print the out-of-scope file list.
- Make clear that Samantha rejected the worker output.

## Cleanup Behavior

Default behavior:

- Preserve `.samantha-demo/<demo-id>/` after the run.
- Print the exact cleanup command:

```bash
rm -rf .samantha-demo/<demo-id>
```

Rationale:

- First-run users need to inspect run logs, fixture state, and worker output.
- Automatic cleanup would hide the evidence that makes Samantha different from a
  direct agent call.

Safety requirements:

- The cleanup path must always be under `.samantha-demo/`.
- The command must never print a cleanup path outside the repository unless the
  user explicitly supplied `--demo-root`.
- If `--demo-root` is supplied, the output must repeat that the user selected a
  custom cleanup path.

## Authority Boundaries

The demo may:

- create `.samantha-demo/<demo-id>/`;
- copy the fixture repo;
- initialize and commit a baseline inside the copied fixture repo;
- allocate worker worktrees under `.samantha-demo/<demo-id>/worktrees`;
- write run logs under `.samantha-demo/<demo-id>/runs`;
- dispatch exactly one bounded writer task against the copied fixture repo;
- create a candidate commit inside the worker worktree after gates pass.

The demo must not:

- mutate the user's real repository contents;
- run against the current repository as the target repo;
- accept, merge, push, or clean up lifecycle state outside the demo root;
- edit `README.md`, direction docs, task templates, agent profiles, policy, or
  source code as part of the demo run;
- use private run logs, private lesson artifacts, or BK-specific project
  context;
- create background jobs, launch agents, watchers, remote adapters, dashboards,
  connector access, or hidden memory;
- increase `writerCap` or introduce worker-owned orchestration.

## Demo/Init/Doctor Decision

Decision:

```text
Implement demo:first-run first.
Do not implement init yet.
Do not implement doctor yet.
```

Reasoning:

- `demo:first-run` proves the trust loop in a safe fixture.
- `init` implies onboarding arbitrary real projects, which is a later product
  capability with a larger authority surface.
- `doctor` is useful only if first-run evidence shows repeated environment
  failures that inline preflight messages do not handle.

## Package Runner Decision

Decision:

```text
First public slice: clone/install plus bun run samantha demo:first-run.
Later packaging slice: package runner such as bunx after public metadata is fixed.
```

Reasoning:

- `package.json` is still `private: true` and describes the package as
  personal.
- License and contribution/security surfaces are not ready.
- A package-runner demo should not be implemented before the repository is safe
  to present as a package.

## Validation Boundary

A later implementation slice should be accepted only when this evidence exists:

- focused CLI parser tests for `demo:first-run`;
- focused demo core tests proving generated paths stay under the demo root;
- a test proving the fixture copy is used instead of mutating the source
  fixture;
- a test proving failure output includes `stage`, `reason`, and cleanup
  guidance;
- a test or deterministic check proving `.samantha-demo/` is ignored by git;
- `bun run typecheck`;
- `bun test`;
- one real local demo run recorded in an operation report, if Codex runtime
  credentials are available in the environment.

If runtime credentials are unavailable, implementation may still be reviewed
with tests plus a documented blocked demo run, but it must not claim full
first-run success.

## Stop Conditions For Implementation

Stop before implementation or acceptance if:

- the demo needs to run against the user's real project;
- the demo requires publishing a package first;
- the demo requires new remote, daemon, background, scheduler, connector, or
  dashboard authority;
- the implementation needs to weaken task specs, worktree isolation, scope
  checks, `HARNESS_RESULT`, deterministic verification, run logs, or
  Samantha-owned commit/report gates;
- the fixture cannot be made dependency-free;
- cleanup cannot be constrained to `.samantha-demo/<demo-id>/` or an explicit
  user-provided `--demo-root`.

## Plan Readiness Review

- Stage classification: architecture / roadmap plan for later implementation.
- Artifact decision: use this operation brief as the decision-complete demo
  contract; do not create a task spec yet.
- Durable artifact path:
  `references/operations/open-source-first-run-demo-brief.md`
- Accepted decisions used:
  `references/initiatives/open-source-readiness.md` and
  `references/operations/open-source-readiness-audit.md`
- Decision debt:
  license choice, package name, public artifact map, README rewrite, and
  feedback templates remain separate slices.
- Target capability:
  safe one-command local demo of the trust loop.
- Proposed execution unit:
  one later `cli-command` writer task for `demo:first-run`, fixtures, tests, and
  `.gitignore` update.
- Slice sizing gate:
  keep `demo:first-run` implementation separate from public README rewrite,
  package publishing, license/contribution docs, and feedback templates.
- Verification strategy:
  focused CLI/core tests, `.gitignore` check, typecheck, full tests, and a real
  demo run when runtime credentials are available.
- Stop conditions:
  listed above.
- Plan verdict:
  ready_for_command after BK accepts this brief.

## Recommended Next Prompt

```text
sam c: Samantha open-source first-run demo command를 구현할 task spec 방향을 잡아주세요.
Context: 기준 문서는 references/operations/open-source-first-run-demo-brief.md 입니다.
Ask: demo:first-run CLI, dependency-free fixture repo, generated demo root, scoped task generation, safe output, cleanup guidance, and focused tests를 하나의 implementation slice로 정리해주세요.
Technical execution: 아직 직접 구현하지 말고, 먼저 task spec targetFiles/forbiddenChanges/verifyCommands/instructions를 제안하세요. Samantha self-build gate를 유지합니다.
Scope: demo:first-run에 필요한 CLI/core/fixture/test/.gitignore 변경만 포함합니다. README rewrite, package publishing, LICENSE/CONTRIBUTING/SECURITY, feedback templates, init, doctor는 제외합니다.
Output: task spec proposal or task spec path recommendation.
Stop: 실제 구현 전에 targetFiles, forbiddenChanges, verifyCommands가 불명확하면 멈추고 질문하세요.
```
