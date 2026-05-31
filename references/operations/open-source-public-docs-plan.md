# Open Source Public Docs Plan

Date: 2026-05-31
Status: README-rewrite prerequisite plan
Source initiative: `references/initiatives/open-source-readiness.md`
Source artifact map: `references/operations/open-source-artifact-map.md`
Accepted demo evidence: `references/operations/open-source-first-run-demo-dogfood.md`
Accepted demo commit: `413991128f3f0718c05846d23c018a38c4c33c7f`

## Purpose

This plan defines the public docs restructuring required before rewriting
`README.md`. It turns the public artifact map into a concrete README rewrite
boundary, feedback intake plan, and release-gating checklist.

This slice is documentation-only. It does not rewrite `README.md`, change
package metadata, add governance files, move references, or alter source,
tests, examples, task templates, agent profiles, playbooks, lessons, runs, or
dogfood evidence.

## Public Docs Restructuring

The first public docs must optimize for one reader question:

```text
How do I run the trust loop locally and inspect why Samantha accepted or
rejected worker output?
```

Restructure public docs around this order:

| Layer | Role | First public treatment |
| --- | --- | --- |
| `README.md` | Main public entrypoint. | Explain positioning, run `demo:first-run`, show evidence outputs, then link advanced docs. |
| Demo evidence docs | Proof that the first-run command works. | Link `open-source-first-run-demo-dogfood.md` after the quickstart, not before it. |
| Architecture/direction docs | Explain why the harness owns trust transitions. | Generalize language and link after the demo path. |
| Operating guides | Advanced local dogfood procedures. | Mark as advanced or dogfood until generalized. |
| `references/` | Evidence registry and planning archive. | Do not present the whole directory as public docs. Link only reviewed public artifacts. |
| CLI help | Command discovery. | Put `demo:first-run` first in docs; keep advanced command families clearly labeled. |

Public docs should use `user`, `operator`, or `local developer` as the default
actor. Use `BK` only when a document is explicitly labeled as historical
dogfood evidence.

## README Rewrite Section Order

The README rewrite should use this section order:

1. `# Samantha Harness`
2. `What Samantha Is`
   - Public framing: local harness for deciding when agent work is safe to
     accept.
   - Non-framing: not a more autonomous coding agent, SaaS control plane, or
     generic multi-project orchestrator.
3. `The Trust Loop`
   - Minimal flow from user goal to task spec, isolated worktree,
     `HARNESS_RESULT`, deterministic verification, run log/report, and
     Samantha-owned accept decision.
4. `Quickstart: First-Run Demo`
   - Command:
     `bun run samantha demo:first-run`
   - Mention `--runtime=codex-sdk` only when documenting the accepted dogfood
     command or runtime selection.
   - State that the demo uses a disposable fixture repository under
     `.samantha-demo/`.
5. `What Success Looks Like`
   - Show the expected compact result fields:
     demo id, fixture repo, worker worktree, run log, `HARNESS_RESULT`,
     verification, candidate commit, merge status, cleanup.
   - Keep any pasted output short and fixture-only.
6. `What Samantha Will Not Do In The First Public Path`
   - No mutation of the user's real repo in the demo.
   - No remote operation, background daemon, connector/control-plane entrypoint,
     budget governance, dashboards, writer parallelism, or multi-project
     orchestration.
7. `Core Concepts`
   - Task spec.
   - Worker.
   - Isolated worktree.
   - Target files and forbidden changes.
   - Deterministic verification.
   - `HARNESS_RESULT`.
   - Run log/report.
   - Candidate commit and accept boundary.
8. `Current Command Surface`
   - Public first: `demo:first-run`.
   - Advanced: `run-task`, `runs:*`, `worktree:cleanup`, `reports:*`,
     `lessons:*`, `continuation:*`, `batches:*`, `batch-plans:*`,
     `readiness:check`, and `tasks:*`.
9. `Repository Map`
   - Top-level docs.
   - `examples/first-run-demo/fixture-repo/`.
   - Public readiness artifacts.
   - Dogfood/private evidence warning for broad `references/` and `runs/`.
10. `Feedback`
    - Point to issue/discussion templates once S5 creates them.
    - Until then, list the information early testers should include.
11. `Release Maturity`
    - Active dogfood harness, not polished platform.
    - Link accepted first-run evidence:
      `references/operations/open-source-first-run-demo-dogfood.md`.

The README rewrite should not lead with the full CLI list, internal folder
tree, BK-specific operating contract, BatchSpec workflows, lesson promotion, or
Samantha self-build doctrine.

## What Not To Expose In The First Public Path

Do not expose these as first-run or main README concepts:

- private run history under `runs/**`;
- generated execution state under `worktrees/**`, `.samantha-worktrees/**`, or
  `.samantha-demo/**`;
- target-project artifacts for HaLucy, Haechi, Hermes, Toss, or other private
  work;
- raw lesson inbox entries, lesson review JSON, and correction transcripts;
- LaunchAgent/background operation templates;
- thread-control artifacts;
- BatchSpec execution, batch-plan replacement, and writer fanout as ordinary
  onboarding commands;
- remote operation, connector/control-plane entrypoints, background scheduling,
  budget governance, dashboards, or multi-project orchestration;
- package-runner distribution promises before package metadata, license, and
  governance surfaces exist.

These surfaces can remain in the repository during dogfood. The public docs
must label or route around them until a later slice moves, redacts, or promotes
specific artifacts.

## Feedback Intake Plan

S5 should create a feedback intake surface before public release. Until the
repo has formal templates, the README should ask early testers to report:

- environment: OS, shell, Bun version, Git version, and selected worker runtime;
- install or clone path used;
- exact command run, especially `bun run samantha demo:first-run`;
- whether `.samantha-demo/<demo-id>/` was created;
- demo stage: preflight, fixture setup, dispatch, worker,
  `HARNESS_RESULT`, verification, candidate commit, cleanup;
- run log path if available;
- whether the failure felt too strict, too loose, or unclear;
- whether the trust gates made the worker output more inspectable;
- what the user expected Samantha to do that it intentionally did not do.

Recommended S5 artifacts:

- `ISSUE_TEMPLATE/first-run-demo.yml` or equivalent issue template;
- workflow-feedback discussion template if discussions are enabled;
- short release note section that asks for gate-friction feedback rather than
  broad feature requests.

Feedback intake should avoid inviting requests for remote operation,
background automation, dashboards, connector expansion, budget governance,
writer parallelism, or multi-project orchestration as first-release goals.

## Release-Gating Checklist

Before the public README rewrite is considered complete:

- `README.md` starts with the trust loop and first-run demo, not BK-specific
  dogfood history.
- The quickstart command is `bun run samantha demo:first-run`.
- The README explains the disposable fixture path and cleanup behavior.
- The README links accepted demo evidence at
  `references/operations/open-source-first-run-demo-dogfood.md`.
- The accepted demo commit
  `413991128f3f0718c05846d23c018a38c4c33c7f` is recorded as evidence, not as a
  user setup requirement.
- Public docs distinguish public artifacts from dogfood/private evidence.
- `references/` is not advertised as a public docs directory without a boundary
  warning.
- `runs/**` and generated worktrees are not exposed as public onboarding data.
- Advanced command families are labeled advanced and authority-sensitive.
- Non-goals are visible near the quickstart.
- Feedback intake asks for first-run evidence and gate-friction reports.
- No README copy promises package publication, arbitrary repo adoption,
  background operation, writer parallelism, or remote orchestration.

Before the first public release is considered ready:

- S1 audit is complete.
- S2 first-run demo contract is complete.
- S3 public docs restructuring and README rewrite are complete.
- S4 `demo:first-run` implementation and dogfood evidence are accepted.
- S5 feedback intake exists.
- Package metadata, license, contribution, security, and code-of-conduct
  decisions are handled in explicit later slices.

## Follow-Up Slices

Recommended order after this plan:

| Slice | Type | Output |
| --- | --- | --- |
| S3b | docs-only | Rewrite `README.md` using this plan and the public artifact map. |
| S5a | docs-only | Add first-run feedback issue/discussion templates and release-note copy. |
| Governance | docs-only or policy | Decide and add `LICENSE`, `CONTRIBUTING`, `SECURITY`, and `CODE_OF_CONDUCT`. |
| Packaging | implementation/docs | Generalize package metadata only after governance and README are ready. |

Each follow-up must keep the dogfood-private split intact unless the task
explicitly authorizes moving, redacting, deleting, or promoting specific
artifacts.
